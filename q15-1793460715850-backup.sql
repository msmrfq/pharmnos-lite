--
-- PostgreSQL database dump
--

\restrict qNqiJITarGJz48yfKgS8Ic2JhzLFazg65incMj6bxd8tqEq8nddDMOczVivPKxB

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: q14_security; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA q14_security;


--
-- Name: AuditEventType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AuditEventType" AS ENUM (
    'AUTH_LOGIN',
    'AUTH_LOGOUT',
    'USER_INVITED',
    'USER_ROLE_CHANGED',
    'BUSINESS_PROFILE_UPDATED',
    'INVOICE_CREATED',
    'INVOICE_FINALIZED',
    'INVOICE_CANCELLED',
    'PURCHASE_CREATED',
    'PURCHASE_FINALIZED',
    'STOCK_ADJUSTED',
    'PRICE_UPDATED',
    'PRODUCT_CREATED',
    'PRODUCT_UPDATED',
    'CUSTOMER_DEACTIVATED',
    'SUPPLIER_DEACTIVATED'
);


--
-- Name: InvoiceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InvoiceStatus" AS ENUM (
    'DRAFT',
    'FINALIZED',
    'CANCELLED'
);


--
-- Name: LedgerEntryType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LedgerEntryType" AS ENUM (
    'INVOICE',
    'PAYMENT_RECEIVED',
    'CREDIT_NOTE',
    'PURCHASE',
    'PAYMENT_MADE',
    'DEBIT_NOTE',
    'OPENING_BALANCE'
);


--
-- Name: PaymentMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentMode" AS ENUM (
    'CASH',
    'CARD',
    'UPI',
    'CREDIT',
    'MIXED'
);


--
-- Name: PermissionAction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PermissionAction" AS ENUM (
    'manage_users',
    'manage_roles',
    'manage_business_profile',
    'create_product',
    'edit_product',
    'view_product',
    'create_customer',
    'edit_customer',
    'view_customer',
    'create_supplier',
    'edit_supplier',
    'view_supplier',
    'create_purchase',
    'edit_purchase',
    'view_purchase',
    'accept_purchase_gst',
    'finalize_purchase',
    'create_invoice',
    'edit_invoice',
    'view_invoice',
    'finalize_invoice',
    'cancel_invoice',
    'view_inventory',
    'adjust_stock',
    'manage_batches',
    'view_customer_ledger',
    'view_supplier_ledger',
    'view_reports',
    'view_audit_log'
);


--
-- Name: PurchaseGstAccountingAcceptanceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PurchaseGstAccountingAcceptanceStatus" AS ENUM (
    'NOT_ACCEPTED',
    'ACCEPTED'
);


--
-- Name: PurchaseGstEvidenceRevisionKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PurchaseGstEvidenceRevisionKind" AS ENUM (
    'INITIAL',
    'CORRECTION'
);


--
-- Name: PurchaseGstReconciliationEventKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PurchaseGstReconciliationEventKind" AS ENUM (
    'EVIDENCE_CAPTURED',
    'CALCULATION_RECORDED',
    'MATCHED',
    'DISCREPANCY_REQUIRES_REVIEW',
    'RESOLVED',
    'ACCOUNTING_ACCEPTED',
    'CORRECTED'
);


--
-- Name: PurchaseGstReconciliationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PurchaseGstReconciliationStatus" AS ENUM (
    'NOT_RECONCILED',
    'MATCHED',
    'DISCREPANCY_REQUIRES_REVIEW',
    'RESOLVED'
);


--
-- Name: ScheduleClass; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ScheduleClass" AS ENUM (
    'H',
    'H1',
    'X',
    'SCHEDULE_H',
    'SCHEDULE_H1',
    'SCHEDULE_X',
    'OTC',
    'OTHER'
);


--
-- Name: StockMovementType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StockMovementType" AS ENUM (
    'PURCHASE_IN',
    'SALE_OUT',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'SALES_RETURN_IN',
    'PURCHASE_RETURN_OUT',
    'OPENING_STOCK'
);


--
-- Name: SystemRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SystemRole" AS ENUM (
    'ADMIN',
    'BILLING',
    'INVENTORY',
    'MANAGER'
);


--
-- Name: TaxDataStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TaxDataStatus" AS ENUM (
    'UNVERIFIED_DRAFT',
    'COMPLETE',
    'LEGACY_AGGREGATE_ONLY',
    'PARTIAL',
    'UNRESOLVED'
);


--
-- Name: guard_purchase_posting_transition(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_purchase_posting_transition() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
     BEGIN
       IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
          OR NEW.purchase_invoice_id IS DISTINCT FROM OLD.purchase_invoice_id
          OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
          OR NEW.request_payload_hash IS DISTINCT FROM OLD.request_payload_hash
       THEN
         RAISE EXCEPTION 'Posting operation identity is immutable'
           USING ERRCODE = '23514';
       END IF;
       IF NEW.status IS DISTINCT FROM OLD.status
          AND NOT (OLD.status = 'PROCESSING' AND NEW.status IN ('COMPLETED', 'FAILED'))
       THEN
         RAISE EXCEPTION 'Invalid purchase posting transition'
           USING ERRCODE = '23514';
       END IF;
       RETURN NEW;
     END;
     $$;


--
-- Name: guard_sales_posting_transition(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_sales_posting_transition() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
      BEGIN
        IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
           OR NEW.sales_invoice_id IS DISTINCT FROM OLD.sales_invoice_id
           OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
           OR NEW.request_payload_hash IS DISTINCT FROM OLD.request_payload_hash THEN
          RAISE EXCEPTION 'Sales posting operation identity is immutable' USING ERRCODE = '23514';
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status
           AND NOT (OLD.status = 'PROCESSING' AND NEW.status IN ('COMPLETED', 'FAILED')) THEN
          RAISE EXCEPTION 'Invalid sales posting transition' USING ERRCODE = '23514';
        END IF;
        IF NEW.status = 'PROCESSING'
           AND (NEW.result_invoice_no IS NOT NULL OR NEW.result_sales_id IS NOT NULL) THEN
          RAISE EXCEPTION 'Processing sales operation cannot have a result' USING ERRCODE = '23514';
        END IF;
        IF NEW.status = 'COMPLETED'
           AND (NEW.result_invoice_no IS NULL OR NEW.result_sales_id IS NULL) THEN
          RAISE EXCEPTION 'Completed sales operation requires a result' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $$;


--
-- Name: prevent_finalized_purchase_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_finalized_purchase_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
     BEGIN
       IF OLD.status = 'FINALIZED'::public."InvoiceStatus"
          AND (NEW.status IS DISTINCT FROM OLD.status
            OR NEW.current_gst_evidence_revision_id IS DISTINCT FROM OLD.current_gst_evidence_revision_id
            OR NEW.current_gst_calculation_id IS DISTINCT FROM OLD.current_gst_calculation_id
            OR NEW.current_gst_accounting_decision_id IS DISTINCT FROM OLD.current_gst_accounting_decision_id
            OR NEW.gst_reconciliation_status IS DISTINCT FROM OLD.gst_reconciliation_status
            OR NEW.gst_accounting_acceptance_status IS DISTINCT FROM OLD.gst_accounting_acceptance_status
            OR NEW.gst_record_version IS DISTINCT FROM OLD.gst_record_version)
       THEN
         RAISE EXCEPTION 'Finalized purchase GST facts are immutable'
           USING ERRCODE = '42501';
       END IF;
       RETURN NEW;
     END;
     $$;


--
-- Name: prevent_finalized_sales_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_finalized_sales_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
     DECLARE
       invoice_status public."InvoiceStatus";
     BEGIN
       IF TG_TABLE_NAME = 'sales_invoices' THEN
         IF OLD.status = 'FINALIZED'::public."InvoiceStatus" THEN
           RAISE EXCEPTION 'Finalized sales invoice facts are immutable'
             USING ERRCODE = '42501';
         END IF;
       ELSE
         SELECT status INTO invoice_status
         FROM public."sales_invoices"
         WHERE id = OLD.invoice_id AND tenant_id = OLD.tenant_id;
         IF invoice_status = 'FINALIZED'::public."InvoiceStatus" THEN
           RAISE EXCEPTION 'Finalized sales invoice lines are immutable'
             USING ERRCODE = '42501';
         END IF;
       END IF;
       RETURN NEW;
     END;
     $$;


--
-- Name: prevent_financial_history_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_financial_history_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
     BEGIN
       RAISE EXCEPTION 'Immutable financial history cannot be changed: %', TG_TABLE_NAME
         USING ERRCODE = '42501';
     END;
     $$;


--
-- Name: approve_soft_delete(text, text); Type: FUNCTION; Schema: q14_security; Owner: -
--

CREATE FUNCTION q14_security.approve_soft_delete(p_request_id text, p_actor_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'q14_security'
    AS $$
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
       OR current_setting('request.jwt.claim.tenant_id', true) <> request_row.tenant_id
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
$$;


--
-- Name: eligible_probe_trigger(); Type: FUNCTION; Schema: q14_security; Owner: -
--

CREATE FUNCTION q14_security.eligible_probe_trigger() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;


--
-- Name: execute_soft_delete(text, text); Type: FUNCTION; Schema: q14_security; Owner: -
--

CREATE FUNCTION q14_security.execute_soft_delete(p_request_id text, p_actor_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'q14_security'
    AS $$
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
       OR current_setting('request.jwt.claim.tenant_id', true) <> request_row.tenant_id
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
$$;


--
-- Name: maintain_allowlisted_trigger(text, text, text, text, boolean, boolean); Type: FUNCTION; Schema: q14_security; Owner: -
--

CREATE FUNCTION q14_security.maintain_allowlisted_trigger(p_trigger_name text, p_table_name text, p_purpose text, p_actor_id text, p_simulate_operation_failure boolean DEFAULT false, p_simulate_restore_failure boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'q14_security'
    AS $$
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
$$;


--
-- Name: request_soft_delete(text, text, text, text, text); Type: FUNCTION; Schema: q14_security; Owner: -
--

CREATE FUNCTION q14_security.request_soft_delete(p_tenant_id text, p_target_table text, p_target_id text, p_reason text, p_actor_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'q14_security'
    AS $$
DECLARE
    request_id text := 'q14-delete-' || md5(clock_timestamp()::text || random()::text);
    target_exists boolean := false;
    caller_role text := coalesce(nullif(current_setting('role', true), 'none'), session_user);
BEGIN
    IF caller_role <> 'pharmnos_e2e_runtime'
       OR current_setting('request.jwt.claim.tenant_id', true) <> p_tenant_id
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
$$;


--
-- Name: verify_trigger_state(text, text); Type: FUNCTION; Schema: q14_security; Owner: -
--

CREATE FUNCTION q14_security.verify_trigger_state(p_trigger_name text, p_table_name text) RETURNS boolean
    LANGUAGE plpgsql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
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
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    tenant_id text NOT NULL,
    event_type public."AuditEventType" NOT NULL,
    actor_id text,
    target_type text,
    target_id text,
    metadata jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.audit_logs FORCE ROW LEVEL SECURITY;


--
-- Name: business_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_profiles (
    id text NOT NULL,
    tenant_id text NOT NULL,
    address_line_1 text,
    address_line_2 text,
    city text,
    state text,
    pincode text,
    country text DEFAULT 'India'::text NOT NULL,
    gstin text,
    pan text,
    drug_license_no_1 text,
    drug_license_no_2 text,
    contact_phone text,
    contact_email text,
    invoice_prefix text DEFAULT 'INV'::text NOT NULL,
    invoice_next_seq integer DEFAULT 1 NOT NULL,
    purchase_prefix text DEFAULT 'PUR'::text NOT NULL,
    purchase_next_seq integer DEFAULT 1 NOT NULL,
    default_gst_rate numeric(5,2),
    near_expiry_days integer DEFAULT 60 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.business_profiles FORCE ROW LEVEL SECURITY;


--
-- Name: customer_ledgers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_ledgers (
    id text NOT NULL,
    tenant_id text NOT NULL,
    customer_id text NOT NULL,
    entry_type public."LedgerEntryType" NOT NULL,
    debit numeric(14,2) DEFAULT 0 NOT NULL,
    credit numeric(14,2) DEFAULT 0 NOT NULL,
    balance numeric(14,2) NOT NULL,
    reference_type text,
    reference_id text,
    invoice_id text,
    narration text,
    entry_date timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.customer_ledgers FORCE ROW LEVEL SECURITY;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id text NOT NULL,
    tenant_id text NOT NULL,
    code text,
    business_name text NOT NULL,
    contact_person text,
    phone text,
    mobile text,
    email text,
    billing_address_1 text,
    billing_address_2 text,
    billing_city text,
    billing_state text,
    billing_pincode text,
    gstin text,
    drug_license_no_1 text,
    drug_license_no_2 text,
    credit_limit numeric(14,2),
    opening_balance numeric(14,2),
    receivable_balance numeric(14,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.customers FORCE ROW LEVEL SECURITY;


--
-- Name: memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memberships (
    id text NOT NULL,
    tenant_id text NOT NULL,
    user_id text NOT NULL,
    role_id text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    invited_by text,
    invited_at timestamp(3) without time zone,
    joined_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.memberships FORCE ROW LEVEL SECURITY;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id text NOT NULL,
    tenant_id text NOT NULL,
    customer_id text,
    invoice_id text,
    entry_type public."LedgerEntryType" NOT NULL,
    payment_mode public."PaymentMode",
    amount numeric(14,2) NOT NULL,
    reference_no text,
    payment_date timestamp(3) without time zone NOT NULL,
    notes text,
    created_by text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.payments FORCE ROW LEVEL SECURITY;


--
-- Name: product_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_batches (
    id text NOT NULL,
    tenant_id text NOT NULL,
    product_id text NOT NULL,
    batch_no text NOT NULL,
    expiry_date timestamp(3) without time zone,
    mrp numeric(12,2),
    purchase_rate numeric(12,2),
    sale_rate numeric(12,2),
    received_qty integer DEFAULT 0 NOT NULL,
    available_qty integer DEFAULT 0 NOT NULL,
    supplier_id text,
    purchase_id text,
    is_blocked boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.product_batches FORCE ROW LEVEL SECURITY;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id text NOT NULL,
    tenant_id text NOT NULL,
    sku text,
    name text NOT NULL,
    generic_name text,
    manufacturer text,
    pack_size text,
    hsn_code text,
    gst_rate numeric(5,2) NOT NULL,
    schedule_classification public."ScheduleClass",
    mrp numeric(12,2),
    standard_sale_rate numeric(12,2),
    purchase_rate numeric(12,2),
    reorder_level integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    created_by text
);

ALTER TABLE ONLY public.products FORCE ROW LEVEL SECURITY;


--
-- Name: purchase_gst_accounting_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_gst_accounting_decisions (
    id text NOT NULL,
    tenant_id text NOT NULL,
    purchase_invoice_id text NOT NULL,
    evidence_revision_id text NOT NULL,
    calculation_id text NOT NULL,
    accepted_taxable_value numeric(20,4),
    accepted_cgst numeric(20,4),
    accepted_sgst numeric(20,4),
    accepted_igst numeric(20,4),
    accepted_cess numeric(20,4),
    accepted_invoice_total numeric(20,4),
    accepted_round_off numeric(20,4),
    accepted_value_source text NOT NULL,
    decision_reference text NOT NULL,
    decision_outcome text NOT NULL,
    rationale text NOT NULL,
    decided_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    decided_by_membership_id text NOT NULL
);

ALTER TABLE ONLY public.purchase_gst_accounting_decisions FORCE ROW LEVEL SECURITY;


--
-- Name: purchase_gst_calculations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_gst_calculations (
    id text NOT NULL,
    tenant_id text NOT NULL,
    purchase_invoice_id text NOT NULL,
    evidence_revision_id text NOT NULL,
    rule_version text NOT NULL,
    calculated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    calculation_provenance jsonb,
    input_fingerprint text,
    calculated_taxable_value numeric(20,4),
    calculated_cgst numeric(20,4),
    calculated_sgst numeric(20,4),
    calculated_igst numeric(20,4),
    calculated_cess numeric(20,4),
    calculated_invoice_total numeric(20,4),
    calculated_round_off numeric(20,4)
);

ALTER TABLE ONLY public.purchase_gst_calculations FORCE ROW LEVEL SECURITY;


--
-- Name: purchase_gst_evidence_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_gst_evidence_revisions (
    id text NOT NULL,
    tenant_id text NOT NULL,
    purchase_invoice_id text NOT NULL,
    revision_number integer NOT NULL,
    revision_kind public."PurchaseGstEvidenceRevisionKind" NOT NULL,
    supersedes_revision_id text,
    source_document_reference text,
    capture_channel text NOT NULL,
    capture_provenance jsonb,
    correction_reason text,
    captured_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    captured_by_membership_id text NOT NULL,
    declared_taxable_value_raw text,
    declared_cgst_raw text,
    declared_sgst_raw text,
    declared_igst_raw text,
    declared_cess_raw text,
    declared_invoice_total_raw text,
    declared_round_off_raw text,
    declared_taxable_value numeric(20,4),
    declared_cgst numeric(20,4),
    declared_sgst numeric(20,4),
    declared_igst numeric(20,4),
    declared_cess numeric(20,4),
    declared_invoice_total numeric(20,4),
    declared_round_off numeric(20,4),
    supplier_state_at_transaction text,
    recipient_state_at_transaction text,
    delivery_state_at_transaction text,
    supply_scenario text,
    supply_facts jsonb,
    source_fingerprint text
);

ALTER TABLE ONLY public.purchase_gst_evidence_revisions FORCE ROW LEVEL SECURITY;


--
-- Name: purchase_gst_line_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_gst_line_evidence (
    id text NOT NULL,
    tenant_id text NOT NULL,
    purchase_invoice_id text NOT NULL,
    evidence_revision_id text NOT NULL,
    purchase_invoice_item_id text NOT NULL,
    declared_taxable_value_raw text,
    declared_cgst_raw text,
    declared_sgst_raw text,
    declared_igst_raw text,
    declared_cess_raw text,
    declared_line_total_raw text,
    declared_taxable_value numeric(20,4),
    declared_cgst numeric(20,4),
    declared_sgst numeric(20,4),
    declared_igst numeric(20,4),
    declared_cess numeric(20,4),
    declared_line_total numeric(20,4)
);

ALTER TABLE ONLY public.purchase_gst_line_evidence FORCE ROW LEVEL SECURITY;


--
-- Name: purchase_gst_reconciliation_event_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_gst_reconciliation_event_lines (
    id text NOT NULL,
    tenant_id text NOT NULL,
    purchase_invoice_id text NOT NULL,
    evidence_revision_id text NOT NULL,
    event_id text NOT NULL,
    line_evidence_id text NOT NULL
);

ALTER TABLE ONLY public.purchase_gst_reconciliation_event_lines FORCE ROW LEVEL SECURITY;


--
-- Name: purchase_gst_reconciliation_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_gst_reconciliation_events (
    id text NOT NULL,
    tenant_id text NOT NULL,
    purchase_invoice_id text NOT NULL,
    evidence_revision_id text NOT NULL,
    event_kind public."PurchaseGstReconciliationEventKind" NOT NULL,
    from_status public."PurchaseGstReconciliationStatus",
    to_status public."PurchaseGstReconciliationStatus",
    operation text NOT NULL,
    idempotency_key text NOT NULL,
    request_payload_hash text,
    decision_reference text,
    rule_version text,
    actor_membership_id text,
    declared_snapshot jsonb,
    calculated_snapshot jsonb,
    accepted_snapshot jsonb,
    discrepancy_details jsonb,
    metadata jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.purchase_gst_reconciliation_events FORCE ROW LEVEL SECURITY;


--
-- Name: purchase_invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_invoice_items (
    id text NOT NULL,
    tenant_id text NOT NULL,
    purchase_id text NOT NULL,
    product_id text NOT NULL,
    batch_no text NOT NULL,
    expiry_date timestamp(3) without time zone,
    quantity integer NOT NULL,
    free_qty integer DEFAULT 0 NOT NULL,
    purchase_rate numeric(12,2) NOT NULL,
    discount_pct numeric(5,2),
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    gst_rate numeric(5,2) NOT NULL,
    gst_amount numeric(12,2) DEFAULT 0 NOT NULL,
    mrp numeric(12,2),
    sale_rate numeric(12,2),
    line_total numeric(14,2) NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    hsn_code_snapshot text,
    calculated_taxable_value numeric(20,4),
    calculated_cgst numeric(20,4),
    calculated_sgst numeric(20,4),
    calculated_igst numeric(20,4),
    calculated_cess numeric(20,4),
    accepted_taxable_value numeric(20,4),
    accepted_cgst numeric(20,4),
    accepted_sgst numeric(20,4),
    accepted_igst numeric(20,4),
    accepted_cess numeric(20,4),
    gst_acceptance_status text DEFAULT 'NOT_ACCEPTED'::text NOT NULL,
    gst_discrepancy_details jsonb,
    gst_calculation_reference text,
    gst_acceptance_reference text
);

ALTER TABLE ONLY public.purchase_invoice_items FORCE ROW LEVEL SECURITY;


--
-- Name: purchase_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_invoices (
    id text NOT NULL,
    tenant_id text NOT NULL,
    invoice_no text NOT NULL,
    supplier_id text NOT NULL,
    supplier_invoice_no text,
    invoice_date timestamp(3) without time zone NOT NULL,
    status public."InvoiceStatus" DEFAULT 'DRAFT'::public."InvoiceStatus" NOT NULL,
    gst_reconciliation_status public."PurchaseGstReconciliationStatus" DEFAULT 'NOT_RECONCILED'::public."PurchaseGstReconciliationStatus" NOT NULL,
    gst_accounting_acceptance_status public."PurchaseGstAccountingAcceptanceStatus" DEFAULT 'NOT_ACCEPTED'::public."PurchaseGstAccountingAcceptanceStatus" NOT NULL,
    current_gst_evidence_revision_id text,
    current_gst_calculation_id text,
    current_gst_accounting_decision_id text,
    gst_record_version integer DEFAULT 0 NOT NULL,
    gross_amount numeric(14,2) NOT NULL,
    total_discount numeric(14,2) DEFAULT 0 NOT NULL,
    total_tax numeric(14,2) DEFAULT 0 NOT NULL,
    round_off numeric(10,2) DEFAULT 0 NOT NULL,
    net_amount numeric(14,2) NOT NULL,
    notes text,
    created_by text,
    finalized_at timestamp(3) without time zone,
    cancelled_at timestamp(3) without time zone,
    cancelled_by text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.purchase_invoices FORCE ROW LEVEL SECURITY;


--
-- Name: purchase_posting_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_posting_operations (
    id text NOT NULL,
    tenant_id text NOT NULL,
    purchase_invoice_id text NOT NULL,
    idempotency_key text NOT NULL,
    request_payload_hash text NOT NULL,
    status text DEFAULT 'PROCESSING'::text NOT NULL,
    result_invoice_no text,
    result_purchase_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.purchase_posting_operations FORCE ROW LEVEL SECURITY;


--
-- Name: q14_maintenance_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.q14_maintenance_audit (
    id text NOT NULL,
    operation_id text NOT NULL,
    actor_id text NOT NULL,
    actor_db_role text NOT NULL,
    trigger_name text NOT NULL,
    table_name text NOT NULL,
    purpose text NOT NULL,
    action text NOT NULL,
    outcome text NOT NULL,
    authorization_result text NOT NULL,
    changed_state text NOT NULL,
    restoration_attempted boolean NOT NULL,
    restored boolean NOT NULL,
    post_verification boolean NOT NULL,
    error_detail text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT q14_maintenance_audit_action_check CHECK ((action = 'DISABLE_ENABLE'::text))
);

ALTER TABLE ONLY public.q14_maintenance_audit FORCE ROW LEVEL SECURITY;


--
-- Name: q14_maintenance_probe; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.q14_maintenance_probe (
    id text NOT NULL,
    marker text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: q14_soft_delete_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.q14_soft_delete_audit (
    id text NOT NULL,
    request_id text NOT NULL,
    tenant_id text NOT NULL,
    actor_id text NOT NULL,
    actor_db_role text NOT NULL,
    action text NOT NULL,
    target_table text NOT NULL,
    target_id text NOT NULL,
    outcome text NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT q14_soft_delete_audit_action_check CHECK ((action = ANY (ARRAY['REQUEST'::text, 'APPROVE'::text, 'EXECUTE'::text, 'DENY'::text])))
);

ALTER TABLE ONLY public.q14_soft_delete_audit FORCE ROW LEVEL SECURITY;


--
-- Name: q14_soft_delete_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.q14_soft_delete_requests (
    id text NOT NULL,
    tenant_id text NOT NULL,
    target_table text NOT NULL,
    target_id text NOT NULL,
    reason text NOT NULL,
    requested_by text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_by text,
    approved_at timestamp with time zone,
    executed_by text,
    executed_at timestamp with time zone,
    expires_at timestamp with time zone DEFAULT (now() + '1 day'::interval) NOT NULL,
    status text NOT NULL,
    CONSTRAINT q14_soft_delete_requests_reason_check CHECK (((length(btrim(reason)) >= 3) AND (length(btrim(reason)) <= 500))),
    CONSTRAINT q14_soft_delete_requests_status_check CHECK ((status = ANY (ARRAY['REQUESTED'::text, 'APPROVED'::text, 'EXECUTED'::text, 'REJECTED'::text, 'EXPIRED'::text]))),
    CONSTRAINT q14_soft_delete_requests_target_table_check CHECK ((target_table = ANY (ARRAY['products'::text, 'customers'::text, 'suppliers'::text])))
);

ALTER TABLE ONLY public.q14_soft_delete_requests FORCE ROW LEVEL SECURITY;


--
-- Name: q14_trigger_allowlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.q14_trigger_allowlist (
    trigger_name text NOT NULL,
    table_name text NOT NULL,
    purpose text NOT NULL,
    protection_class text NOT NULL,
    eligible boolean NOT NULL,
    expected_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT q14_trigger_allowlist_protection_class_check CHECK ((protection_class = ANY (ARRAY['ELIGIBLE_MAINTENANCE'::text, 'TENANT_ISOLATION'::text, 'SECURITY'::text, 'AUDIT'::text, 'IMMUTABILITY'::text, 'REFERENTIAL_INTEGRITY'::text, 'FINALIZED_HISTORY'::text])))
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id text NOT NULL,
    role_id text NOT NULL,
    permission public."PermissionAction" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.role_permissions FORCE ROW LEVEL SECURITY;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id text NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    system_role public."SystemRole",
    description text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.roles FORCE ROW LEVEL SECURITY;


--
-- Name: sales_invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_invoice_items (
    id text NOT NULL,
    tenant_id text NOT NULL,
    invoice_id text NOT NULL,
    product_id text NOT NULL,
    batch_id text,
    batch_no text NOT NULL,
    quantity integer NOT NULL,
    free_qty integer DEFAULT 0 NOT NULL,
    sale_rate numeric(12,2) NOT NULL,
    mrp numeric(12,2),
    discount_pct numeric(5,2),
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    taxable_amount numeric(14,2),
    gst_rate numeric(5,2) NOT NULL,
    gst_amount numeric(12,2) DEFAULT 0 NOT NULL,
    cgst_amount numeric(12,2),
    sgst_amount numeric(12,2),
    igst_amount numeric(12,2),
    cess_amount numeric(12,2),
    product_name_snapshot text,
    generic_name_snapshot text,
    hsn_code_snapshot text,
    batch_expiry_snapshot timestamp(3) without time zone,
    line_total numeric(14,2) NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.sales_invoice_items FORCE ROW LEVEL SECURITY;


--
-- Name: sales_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_invoices (
    id text NOT NULL,
    tenant_id text NOT NULL,
    invoice_no text NOT NULL,
    customer_id text,
    invoice_date timestamp(3) without time zone NOT NULL,
    status public."InvoiceStatus" DEFAULT 'DRAFT'::public."InvoiceStatus" NOT NULL,
    tax_data_status public."TaxDataStatus",
    place_of_supply_code text,
    is_cash_sale boolean DEFAULT false NOT NULL,
    gross_amount numeric(14,2) NOT NULL,
    total_discount numeric(14,2) DEFAULT 0 NOT NULL,
    total_tax numeric(14,2) DEFAULT 0 NOT NULL,
    round_off numeric(10,2) DEFAULT 0 NOT NULL,
    net_amount numeric(14,2) NOT NULL,
    paid_amount numeric(14,2) DEFAULT 0 NOT NULL,
    balance_due numeric(14,2) DEFAULT 0 NOT NULL,
    payment_mode public."PaymentMode",
    notes text,
    created_by text,
    finalized_at timestamp(3) without time zone,
    cancelled_at timestamp(3) without time zone,
    cancelled_by text,
    cancel_reason text,
    seller_name_snapshot text,
    seller_address_line_1_snapshot text,
    seller_address_line_2_snapshot text,
    seller_city_snapshot text,
    seller_state_snapshot text,
    seller_pincode_snapshot text,
    seller_gstin_snapshot text,
    customer_name_snapshot text,
    customer_address_line_1_snapshot text,
    customer_address_line_2_snapshot text,
    customer_city_snapshot text,
    customer_state_snapshot text,
    customer_pincode_snapshot text,
    customer_gstin_snapshot text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.sales_invoices FORCE ROW LEVEL SECURITY;


--
-- Name: sales_posting_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_posting_operations (
    id text NOT NULL,
    tenant_id text NOT NULL,
    sales_invoice_id text NOT NULL,
    idempotency_key text NOT NULL,
    request_payload_hash text NOT NULL,
    status text DEFAULT 'PROCESSING'::text NOT NULL,
    result_invoice_no text,
    result_sales_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT sales_posting_operations_status_check CHECK ((status = ANY (ARRAY['PROCESSING'::text, 'COMPLETED'::text, 'FAILED'::text])))
);

ALTER TABLE ONLY public.sales_posting_operations FORCE ROW LEVEL SECURITY;


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id text NOT NULL,
    tenant_id text NOT NULL,
    product_id text NOT NULL,
    batch_id text,
    movement_type public."StockMovementType" NOT NULL,
    quantity_delta integer NOT NULL,
    reference_type text,
    reference_id text,
    unit_rate numeric(12,2),
    notes text,
    created_by text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.stock_movements FORCE ROW LEVEL SECURITY;


--
-- Name: supplier_ledgers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_ledgers (
    id text NOT NULL,
    tenant_id text NOT NULL,
    supplier_id text NOT NULL,
    entry_type public."LedgerEntryType" NOT NULL,
    debit numeric(14,2) DEFAULT 0 NOT NULL,
    credit numeric(14,2) DEFAULT 0 NOT NULL,
    balance numeric(14,2) NOT NULL,
    reference_type text,
    reference_id text,
    purchase_id text,
    narration text,
    entry_date timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.supplier_ledgers FORCE ROW LEVEL SECURITY;


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id text NOT NULL,
    tenant_id text NOT NULL,
    code text,
    business_name text NOT NULL,
    contact_person text,
    phone text,
    mobile text,
    email text,
    address_1 text,
    address_2 text,
    city text,
    state text,
    pincode text,
    gstin text,
    drug_license_no text,
    opening_balance numeric(14,2),
    payable_balance numeric(14,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.suppliers FORCE ROW LEVEL SECURITY;


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id text NOT NULL,
    slug text NOT NULL,
    business_name text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.tenants FORCE ROW LEVEL SECURITY;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    external_id text,
    email text NOT NULL,
    full_name text,
    phone text,
    avatar_url text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);

ALTER TABLE ONLY public.users FORCE ROW LEVEL SECURITY;


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, tenant_id, event_type, actor_id, target_type, target_id, metadata, ip_address, user_agent, created_at) FROM stdin;
cmvvwsibo000820j68wxr7q7z	q10-q14-1793421202430-rollback-tenant	INVOICE_FINALIZED	q10-q14-1793421202430-rollback-user	sales_invoice	q10-q14-1793421202430-rollback-invoice	{"invoice_no": "q10-q14-1793421202430-rollback-draft", "net_amount": 118}	\N	\N	2026-10-31 04:36:31.811
cmvvwtxuk000813ym88sfo2tp	q10-q14-1793421457888-b-tenant	INVOICE_FINALIZED	q10-q14-1793421457888-b-user	sales_invoice	q10-q14-1793421457888-b-invoice	{"invoice_no": "q10-q14-1793421457888-b-draft", "net_amount": 118}	\N	\N	2026-10-31 04:37:38.587
cmvvwvjal0008d1y2qxbbiu9n	q10-q14-1793421457888-rollback-tenant	INVOICE_FINALIZED	q10-q14-1793421457888-rollback-user	sales_invoice	q10-q14-1793421457888-rollback-invoice	{"invoice_no": "q10-q14-1793421457888-rollback-draft", "net_amount": 118}	\N	\N	2026-10-31 04:38:53.037
cmvvwx1o40008zg7xrmpgj752	q10-q14-1793421202430-b-tenant	INVOICE_FINALIZED	q10-q14-1793421202430-b-user	sales_invoice	q10-q14-1793421202430-b-invoice	{"invoice_no": "q10-q14-1793421202430-b-draft", "net_amount": 118}	\N	\N	2026-10-31 04:40:03.507
cmvvwzw0k0008docnpordwd6g	q10-q14-1793421102644-rollback-tenant	INVOICE_FINALIZED	q10-q14-1793421102644-rollback-user	sales_invoice	q10-q14-1793421102644-rollback-invoice	{"invoice_no": "q10-q14-1793421102644-rollback-draft", "net_amount": 118}	\N	\N	2026-10-31 04:42:16.148
cmvvwzw2v000ldocno5blpqdq	q10-q14-1793421102644-b-tenant	INVOICE_FINALIZED	q10-q14-1793421102644-b-user	sales_invoice	q10-q14-1793421102644-b-invoice	{"invoice_no": "q10-q14-1793421102644-b-draft", "net_amount": 118}	\N	\N	2026-10-31 04:42:16.23
cmvvx2pry00089hdl89in9thl	q10-q14-1793421051032-rollback-tenant	INVOICE_FINALIZED	q10-q14-1793421051032-rollback-user	sales_invoice	q10-q14-1793421051032-rollback-invoice	{"invoice_no": "q10-q14-1793421051032-rollback-draft", "net_amount": 118}	\N	\N	2026-10-31 04:44:28.029
cmvvx2ptx000l9hdll5sn2wl9	q10-q14-1793421051032-b-tenant	INVOICE_FINALIZED	q10-q14-1793421051032-b-user	sales_invoice	q10-q14-1793421051032-b-invoice	{"invoice_no": "q10-q14-1793421051032-b-draft", "net_amount": 118}	\N	\N	2026-10-31 04:44:28.1
cmvvx460800084b8g24f9n4ti	q10-q14-1793421934870-rollback-tenant	INVOICE_FINALIZED	q10-q14-1793421934870-rollback-user	sales_invoice	q10-q14-1793421934870-rollback-invoice	{"invoice_no": "q10-q14-1793421934870-rollback-draft", "net_amount": 118}	\N	\N	2026-10-31 04:45:35.72
cmvvx461i000l4b8g8gwg5xie	q10-q14-1793421934870-b-tenant	INVOICE_FINALIZED	q10-q14-1793421934870-b-user	sales_invoice	q10-q14-1793421934870-b-invoice	{"invoice_no": "q10-q14-1793421934870-b-draft", "net_amount": 118}	\N	\N	2026-10-31 04:45:35.766
cmvwazxkd0008ujqzsv3zuarp	q10-q14-1793428213936-rollback-tenant	INVOICE_FINALIZED	q10-q14-1793428213936-rollback-user	sales_invoice	q10-q14-1793428213936-rollback-invoice	{"invoice_no": "q10-q14-1793428213936-rollback-draft", "net_amount": 118}	\N	\N	2026-10-31 11:14:12.78
cmvwazxls000lujqz9y1sfijy	q10-q14-1793428213936-b-tenant	INVOICE_FINALIZED	q10-q14-1793428213936-b-user	sales_invoice	q10-q14-1793428213936-b-invoice	{"invoice_no": "q10-q14-1793428213936-b-draft", "net_amount": 118}	\N	\N	2026-10-31 11:14:12.831
cmvwbfxoq0008xur6f5wgsymy	q10-q14-1793428172549-rollback-tenant	INVOICE_FINALIZED	q10-q14-1793428172549-rollback-user	sales_invoice	q10-q14-1793428172549-rollback-invoice	{"invoice_no": "q10-q14-1793428172549-rollback-draft", "net_amount": 118}	\N	\N	2026-10-31 11:26:39.433
cmvwbkhrj0008t34wkdf1d889	q10-q14-1793428172549-b-tenant	INVOICE_FINALIZED	q10-q14-1793428172549-b-user	sales_invoice	q10-q14-1793428172549-b-invoice	{"invoice_no": "q10-q14-1793428172549-b-draft", "net_amount": 118}	\N	\N	2026-10-31 11:30:12.078
cmvwbm3hg0008a8p26qclg47u	q10-app-1793446286377-tenant	INVOICE_FINALIZED	q10-app-1793446286377-user	sales_invoice	q10-app-1793446286377-invoice-0	{"invoice_no": "q10-app-1793446286377-draft-0", "net_amount": 118}	\N	\N	2026-10-31 11:31:26.883
cmvwbm3sd000ma8p2rc4dlmun	q10-app-1793446286377-tenant	INVOICE_FINALIZED	q10-app-1793446286377-user	sales_invoice	q10-app-1793446286377-invoice-1	{"invoice_no": "q10-app-1793446286377-draft-1", "net_amount": 118}	\N	\N	2026-10-31 11:31:27.276
cmvwbqfz20008ic7xsbwen72g	q10-app-1793446489184-tenant	INVOICE_FINALIZED	q10-app-1793446489184-user	sales_invoice	q10-app-1793446489184-invoice-0	{"invoice_no": "q10-app-1793446489184-draft-0", "net_amount": 118}	\N	\N	2026-10-31 11:34:49.693
cmvwbqg9t000mic7x6rqwaazu	q10-app-1793446489184-tenant	INVOICE_FINALIZED	q10-app-1793446489184-user	sales_invoice	q10-app-1793446489184-invoice-1	{"invoice_no": "q10-app-1793446489184-draft-1", "net_amount": 118}	\N	\N	2026-10-31 11:34:50.08
cmvwbtbfo0008kljejh5g9lc1	q10-app-1793446623070-tenant	INVOICE_FINALIZED	q10-app-1793446623070-user	sales_invoice	q10-app-1793446623070-invoice-0	{"invoice_no": "q10-app-1793446623070-draft-0", "net_amount": 118}	\N	\N	2026-10-31 11:37:03.779
cmvwbtbqe000mkljez9i52g9r	q10-app-1793446623070-tenant	INVOICE_FINALIZED	q10-app-1793446623070-user	sales_invoice	q10-app-1793446623070-invoice-1	{"invoice_no": "q10-app-1793446623070-draft-1", "net_amount": 118}	\N	\N	2026-10-31 11:37:04.166
cmvwcec4800085hhthbysik4y	q10-app-1793447603960-tenant	INVOICE_FINALIZED	q10-app-1793447603960-user	sales_invoice	q10-app-1793447603960-invoice-0	{"invoice_no": "q10-app-1793447603960-draft-0", "net_amount": 118}	\N	\N	2026-10-31 11:53:24.439
cmvwcecet000k5hhtytpp24zi	q10-app-1793447603960-tenant	INVOICE_FINALIZED	q10-app-1793447603960-user	sales_invoice	q10-app-1793447603960-invoice-1	{"invoice_no": "q10-app-1793447603960-draft-1", "net_amount": 118}	\N	\N	2026-10-31 11:53:24.82
cmvwfjgg40008nht7zp66bcwg	q10-app-1793452881250-tenant	INVOICE_FINALIZED	q10-app-1793452881250-user	sales_invoice	q10-app-1793452881250-invoice-0	{"invoice_no": "q10-app-1793452881250-draft-0", "net_amount": 118}	\N	\N	2026-10-31 13:21:22.18
cmvwfjgsg000knht7q3icbqnv	q10-app-1793452881250-tenant	INVOICE_FINALIZED	q10-app-1793452881250-user	sales_invoice	q10-app-1793452881250-invoice-1	{"invoice_no": "q10-app-1793452881250-draft-1", "net_amount": 118}	\N	\N	2026-10-31 13:21:22.623
cmvwfp7yv0008axymerkdg9i1	q10-app-1793453149906-tenant	INVOICE_FINALIZED	q10-app-1793453149906-user	sales_invoice	q10-app-1793453149906-invoice-0	{"invoice_no": "q10-app-1793453149906-draft-0", "net_amount": 118}	\N	\N	2026-10-31 13:25:51.126
cmvwfp8dd000kaxymu76g7sv2	q10-app-1793453149906-tenant	INVOICE_FINALIZED	q10-app-1793453149906-user	sales_invoice	q10-app-1793453149906-invoice-1	{"invoice_no": "q10-app-1793453149906-draft-1", "net_amount": 118}	\N	\N	2026-10-31 13:25:51.648
cmvwfy2t0000k99yrgd6nfe54	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	INVOICE_FINALIZED	gst_e2e_user_1e3d6dc3e3af44828ea74a666498c4b3	sales_invoice	gst_e2e_sales_success_c9722d460e8a47f6916e516454354bd4	{"invoice_no": "DRAFT-54354bd4", "net_amount": 118}	\N	\N	2026-10-31 13:32:44.339
cmvwfzn8u000kza3t7uo41s68	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	INVOICE_FINALIZED	gst_e2e_user_c9bcf582e8ec42a29706c6758a4c5227	sales_invoice	gst_e2e_sales_success_0708541c7aef4e43a298df5fa0fa77e1	{"invoice_no": "DRAFT-a0fa77e1", "net_amount": 118}	\N	\N	2026-10-31 13:33:57.486
cmvwfzne8000vza3t42raplsi	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	PURCHASE_FINALIZED	gst_e2e_user_c9bcf582e8ec42a29706c6758a4c5227	purchase_invoice	gst_e2e_purchase_success_ce69ce80a135405083eb65af66d4e5d2	{"invoice_no": "DRAFT-66d4e5d2", "net_amount": 118}	\N	\N	2026-10-31 13:33:57.679
cmvwg17sz000klgotjvtw0u8g	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	INVOICE_FINALIZED	gst_e2e_user_6c87a7d4a4cf4788828673be1bf2844b	sales_invoice	gst_e2e_sales_success_afdbc6d5a3564cca92e3383e1fbd7e74	{"invoice_no": "DRAFT-1fbd7e74", "net_amount": 118}	\N	\N	2026-10-31 13:35:10.786
cmvwg17zf000vlgotlcik2jzx	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	PURCHASE_FINALIZED	gst_e2e_user_6c87a7d4a4cf4788828673be1bf2844b	purchase_invoice	gst_e2e_purchase_success_53face98828d459ea964e6ea9de2adb0	{"invoice_no": "DRAFT-9de2adb0", "net_amount": 118}	\N	\N	2026-10-31 13:35:11.018
cmvwg2x3o000k2plhapulqb62	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	INVOICE_FINALIZED	gst_e2e_user_f0e91ddf6de143cca30b52d49086168a	sales_invoice	gst_e2e_sales_success_4c9c04755904459bba454f3edc4a0120	{"invoice_no": "DRAFT-dc4a0120", "net_amount": 118}	\N	\N	2026-10-31 13:36:30.228
cmvwg2x8b000v2plh16bbkupf	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	PURCHASE_FINALIZED	gst_e2e_user_f0e91ddf6de143cca30b52d49086168a	purchase_invoice	gst_e2e_purchase_success_396c53317f354bc18e427271a7ab8604	{"invoice_no": "DRAFT-a7ab8604", "net_amount": 118}	\N	\N	2026-10-31 13:36:30.395
cmvwg4nwq000k14ozx7wloag6	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	INVOICE_FINALIZED	gst_e2e_user_eed392649bbe46f59b199bee1f03c7e6	sales_invoice	gst_e2e_sales_success_76727966456547758e6f567b024f8d91	{"invoice_no": "DRAFT-024f8d91", "net_amount": 118}	\N	\N	2026-10-31 13:37:51.625
cmvwg4o0g000v14ozw6mq8u2t	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	PURCHASE_FINALIZED	gst_e2e_user_eed392649bbe46f59b199bee1f03c7e6	purchase_invoice	gst_e2e_purchase_success_1f164fb2783447d69f85f7df093931fa	{"invoice_no": "DRAFT-093931fa", "net_amount": 118}	\N	\N	2026-10-31 13:37:51.76
cmvwg6gj2000kkez5ss6dmjej	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	INVOICE_FINALIZED	gst_e2e_user_543643bc2f9f43bd8fe5cbdaff72cbef	sales_invoice	gst_e2e_sales_success_9e5c4bd6a06442659dae4570dd904250	{"invoice_no": "DRAFT-dd904250", "net_amount": 118}	\N	\N	2026-10-31 13:39:15.373
cmvwg6gml000vkez5ffslk6ie	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	PURCHASE_FINALIZED	gst_e2e_user_543643bc2f9f43bd8fe5cbdaff72cbef	purchase_invoice	gst_e2e_purchase_success_f29700e5a951456bb04d6db56b016c68	{"invoice_no": "DRAFT-6b016c68", "net_amount": 118}	\N	\N	2026-10-31 13:39:15.5
cmvwg818q000kemkiwn1ivpx4	gst_e2e_tenant_19035406820a497699286f211ca126f6	INVOICE_FINALIZED	gst_e2e_user_3df03d91d95a4aa193cd6d6b5b63d29f	sales_invoice	gst_e2e_sales_success_861a943099ab401896b2cf2663424588	{"invoice_no": "DRAFT-63424588", "net_amount": 118}	\N	\N	2026-10-31 13:40:28.874
cmvwg81cz000vemkirp3hk1g6	gst_e2e_tenant_19035406820a497699286f211ca126f6	PURCHASE_FINALIZED	gst_e2e_user_3df03d91d95a4aa193cd6d6b5b63d29f	purchase_invoice	gst_e2e_purchase_success_d51c27ab43b145f195d586fed5ac6f01	{"invoice_no": "DRAFT-d5ac6f01", "net_amount": 118}	\N	\N	2026-10-31 13:40:29.026
cmvwg9m9g000kdaacgx6jjdpy	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	INVOICE_FINALIZED	gst_e2e_user_24a2027af5904578b7fcdaab60fcb210	sales_invoice	gst_e2e_sales_success_ad360a6411064d099a18d08fa4bf62c4	{"invoice_no": "DRAFT-a4bf62c4", "net_amount": 118}	\N	\N	2026-10-31 13:41:42.77
cmvwg9mdq000vdaacl6jlzla9	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	PURCHASE_FINALIZED	gst_e2e_user_24a2027af5904578b7fcdaab60fcb210	purchase_invoice	gst_e2e_purchase_success_aaefa95e91204a878b000841573921e3	{"invoice_no": "DRAFT-573921e3", "net_amount": 118}	\N	\N	2026-10-31 13:41:42.925
cmvwgb6hk000kvg91wlt2r5tc	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	INVOICE_FINALIZED	gst_e2e_user_62a1702e07e74656821fa5094b20b72d	sales_invoice	gst_e2e_sales_success_b3d1b8d7803746e8a34a24ada270c41d	{"invoice_no": "DRAFT-a270c41d", "net_amount": 118}	\N	\N	2026-10-31 13:42:55.639
cmvwgb6mh000vvg91idyfkifn	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	PURCHASE_FINALIZED	gst_e2e_user_62a1702e07e74656821fa5094b20b72d	purchase_invoice	gst_e2e_purchase_success_b47ae86c87784e399a738d3dc2c10eac	{"invoice_no": "DRAFT-c2c10eac", "net_amount": 118}	\N	\N	2026-10-31 13:42:55.817
cmvwgd9rs000ketesjq61echq	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	INVOICE_FINALIZED	gst_e2e_user_b50dbb92d78b45a9947a6a5e5df0cad0	sales_invoice	gst_e2e_sales_success_e95ec457a9c74f97be29242a8011148c	{"invoice_no": "DRAFT-8011148c", "net_amount": 118}	\N	\N	2026-10-31 13:44:33.207
cmvwgd9xk000vetesn9urhbug	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	PURCHASE_FINALIZED	gst_e2e_user_b50dbb92d78b45a9947a6a5e5df0cad0	purchase_invoice	gst_e2e_purchase_success_f1dc1040426446d1986b7570aedcf581	{"invoice_no": "DRAFT-aedcf581", "net_amount": 118}	\N	\N	2026-10-31 13:44:33.415
cmvwgere20008payc757ddwfr	q10-app-1793454341866-tenant	INVOICE_FINALIZED	q10-app-1793454341866-user	sales_invoice	q10-app-1793454341866-invoice-0	{"invoice_no": "q10-app-1793454341866-draft-0", "net_amount": 118}	\N	\N	2026-10-31 13:45:42.697
cmvwges2i000kpaycaqtoeh2o	q10-app-1793454341866-tenant	INVOICE_FINALIZED	q10-app-1793454341866-user	sales_invoice	q10-app-1793454341866-invoice-1	{"invoice_no": "q10-app-1793454341866-draft-1", "net_amount": 118}	\N	\N	2026-10-31 13:45:43.577
cmvwgg78z00082ruv6utddxcl	q10-app-1793454409161-tenant	INVOICE_FINALIZED	q10-app-1793454409161-user	sales_invoice	q10-app-1793454409161-invoice-0	{"invoice_no": "q10-app-1793454409161-draft-0", "net_amount": 118}	\N	\N	2026-10-31 13:46:49.907
cmvwgg7ub000k2ruv7767wipf	q10-app-1793454409161-tenant	INVOICE_FINALIZED	q10-app-1793454409161-user	sales_invoice	q10-app-1793454409161-invoice-1	{"invoice_no": "q10-app-1793454409161-draft-1", "net_amount": 118}	\N	\N	2026-10-31 13:46:50.675
cmvwghz700008jrg0g0gsfqz9	q10-app-1793454491946-tenant	INVOICE_FINALIZED	q10-app-1793454491946-user	sales_invoice	q10-app-1793454491946-invoice-0	{"invoice_no": "q10-app-1793454491946-draft-0", "net_amount": 118}	\N	\N	2026-10-31 13:48:12.78
cmvwghzj5000kjrg0nww6x6e5	q10-app-1793454491946-tenant	INVOICE_FINALIZED	q10-app-1793454491946-user	sales_invoice	q10-app-1793454491946-invoice-1	{"invoice_no": "q10-app-1793454491946-draft-1", "net_amount": 118}	\N	\N	2026-10-31 13:48:13.217
\.


--
-- Data for Name: business_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.business_profiles (id, tenant_id, address_line_1, address_line_2, city, state, pincode, country, gstin, pan, drug_license_no_1, drug_license_no_2, contact_phone, contact_email, invoice_prefix, invoice_next_seq, purchase_prefix, purchase_next_seq, default_gst_rate, near_expiry_days, created_at, updated_at) FROM stdin;
q10-q14-1793420207911-a-profile	q10-q14-1793420207911-a-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QA	1	PUR	1	\N	60	2026-10-31 04:16:47.969	2026-10-31 04:16:47.969
q10-q14-1793420207911-b-profile	q10-q14-1793420207911-b-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QB	1	PUR	1	\N	60	2026-10-31 04:16:48.008	2026-10-31 04:16:48.008
q10-q14-1793420214519-a-profile	q10-q14-1793420214519-a-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QA	1	PUR	1	\N	60	2026-10-31 04:16:54.574	2026-10-31 04:16:54.574
q10-q14-1793420214519-b-profile	q10-q14-1793420214519-b-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QB	1	PUR	1	\N	60	2026-10-31 04:16:54.615	2026-10-31 04:16:54.615
q10-q14-1793420220210-a-profile	q10-q14-1793420220210-a-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QA	1	PUR	1	\N	60	2026-10-31 04:17:00.268	2026-10-31 04:17:00.268
q10-q14-1793420220210-b-profile	q10-q14-1793420220210-b-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QB	1	PUR	1	\N	60	2026-10-31 04:17:00.306	2026-10-31 04:17:00.306
q10-q14-1793420220210-rollback-profile	q10-q14-1793420220210-rollback-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QRO	1	PUR	1	\N	60	2026-10-31 04:17:00.393	2026-10-31 04:17:00.393
q10-q14-1793420220210-concurrent-profile	q10-q14-1793420220210-concurrent-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 04:17:00.434	2026-10-31 04:17:00.434
q10-q14-1793420348045-a-profile	q10-q14-1793420348045-a-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QA	1	PUR	1	\N	60	2026-10-31 04:19:08.093	2026-10-31 04:19:08.093
q10-q14-1793420348045-b-profile	q10-q14-1793420348045-b-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QB	1	PUR	1	\N	60	2026-10-31 04:19:08.125	2026-10-31 04:19:08.125
q10-q14-1793420355327-a-profile	q10-q14-1793420355327-a-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QA	1	PUR	1	\N	60	2026-10-31 04:19:15.377	2026-10-31 04:19:15.377
q10-q14-1793420355327-b-profile	q10-q14-1793420355327-b-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QB	1	PUR	1	\N	60	2026-10-31 04:19:15.409	2026-10-31 04:19:15.409
q10-q14-1793420355327-uncertain-profile	q10-q14-1793420355327-uncertain-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QUN	1	PUR	1	\N	60	2026-10-31 04:19:15.469	2026-10-31 04:19:15.469
q10-q14-1793420355327-rollback-profile	q10-q14-1793420355327-rollback-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QRO	1	PUR	1	\N	60	2026-10-31 04:19:15.508	2026-10-31 04:19:15.508
q10-q14-1793420355327-concurrent-profile	q10-q14-1793420355327-concurrent-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 04:19:15.538	2026-10-31 04:19:15.538
q10-q14-1793420355327-conflicting-profile	q10-q14-1793420355327-conflicting-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 04:19:15.573	2026-10-31 04:19:15.573
q10-q14-1793421051032-a-profile	q10-q14-1793421051032-a-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QA	1	PUR	1	\N	60	2026-10-31 04:30:51.126	2026-10-31 04:30:51.126
q10-q14-1793421051032-b-profile	q10-q14-1793421051032-b-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QB	1	PUR	1	\N	60	2026-10-31 04:30:51.203	2026-10-31 04:30:51.203
q10-q14-1793421051032-uncertain-profile	q10-q14-1793421051032-uncertain-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QUN	1	PUR	1	\N	60	2026-10-31 04:30:51.365	2026-10-31 04:30:51.365
q10-q14-1793421051032-rollback-profile	q10-q14-1793421051032-rollback-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QRO	1	PUR	1	\N	60	2026-10-31 04:30:51.468	2026-10-31 04:30:51.468
q10-q14-1793421051032-concurrent-profile	q10-q14-1793421051032-concurrent-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 04:30:51.534	2026-10-31 04:30:51.534
q10-q14-1793421051032-conflicting-profile	q10-q14-1793421051032-conflicting-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 04:30:51.605	2026-10-31 04:30:51.605
q10-q14-1793421102644-a-profile	q10-q14-1793421102644-a-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QA	1	PUR	1	\N	60	2026-10-31 04:31:42.721	2026-10-31 04:31:42.721
q10-q14-1793421102644-b-profile	q10-q14-1793421102644-b-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QB	1	PUR	1	\N	60	2026-10-31 04:31:42.753	2026-10-31 04:31:42.753
q10-q14-1793421102644-uncertain-profile	q10-q14-1793421102644-uncertain-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QUN	1	PUR	1	\N	60	2026-10-31 04:31:42.822	2026-10-31 04:31:42.822
q10-q14-1793421102644-rollback-profile	q10-q14-1793421102644-rollback-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QRO	1	PUR	1	\N	60	2026-10-31 04:31:42.862	2026-10-31 04:31:42.862
q10-q14-1793421102644-concurrent-profile	q10-q14-1793421102644-concurrent-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 04:31:42.892	2026-10-31 04:31:42.892
q10-q14-1793421102644-conflicting-profile	q10-q14-1793421102644-conflicting-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 04:31:42.928	2026-10-31 04:31:42.928
q10-q14-1793421202430-a-profile	q10-q14-1793421202430-a-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QA	1	PUR	1	\N	60	2026-10-31 04:33:22.534	2026-10-31 04:33:22.534
q10-q14-1793421202430-b-profile	q10-q14-1793421202430-b-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QB	1	PUR	1	\N	60	2026-10-31 04:33:22.583	2026-10-31 04:33:22.583
q10-q14-1793421202430-uncertain-profile	q10-q14-1793421202430-uncertain-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QUN	1	PUR	1	\N	60	2026-10-31 04:33:22.696	2026-10-31 04:33:22.696
q10-q14-1793421202430-rollback-profile	q10-q14-1793421202430-rollback-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QRO	1	PUR	1	\N	60	2026-10-31 04:33:22.771	2026-10-31 04:33:22.771
q10-q14-1793421202430-concurrent-profile	q10-q14-1793421202430-concurrent-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 04:33:22.819	2026-10-31 04:33:22.819
q10-q14-1793421202430-conflicting-profile	q10-q14-1793421202430-conflicting-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 04:33:22.877	2026-10-31 04:33:22.877
q10-q14-1793421457888-a-profile	q10-q14-1793421457888-a-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QA	1	PUR	1	\N	60	2026-10-31 04:37:37.984	2026-10-31 04:37:37.984
q10-q14-1793421457888-b-profile	q10-q14-1793421457888-b-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QB	1	PUR	1	\N	60	2026-10-31 04:37:38.019	2026-10-31 04:37:38.019
q10-q14-1793421457888-uncertain-profile	q10-q14-1793421457888-uncertain-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QUN	1	PUR	1	\N	60	2026-10-31 04:37:38.092	2026-10-31 04:37:38.092
q10-q14-1793421457888-rollback-profile	q10-q14-1793421457888-rollback-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QRO	1	PUR	1	\N	60	2026-10-31 04:37:38.14	2026-10-31 04:37:38.14
q10-q14-1793421457888-concurrent-profile	q10-q14-1793421457888-concurrent-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 04:37:38.176	2026-10-31 04:37:38.176
q10-q14-1793421457888-conflicting-profile	q10-q14-1793421457888-conflicting-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 04:37:38.215	2026-10-31 04:37:38.215
q10-q14-1793421934870-a-profile	q10-q14-1793421934870-a-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QA	1	PUR	1	\N	60	2026-10-31 04:45:34.921	2026-10-31 04:45:34.921
q10-q14-1793421934870-b-profile	q10-q14-1793421934870-b-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QB	1	PUR	1	\N	60	2026-10-31 04:45:34.942	2026-10-31 04:45:34.942
q10-q14-1793421934870-uncertain-profile	q10-q14-1793421934870-uncertain-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QUN	1	PUR	1	\N	60	2026-10-31 04:45:34.984	2026-10-31 04:45:34.984
q10-q14-1793421934870-rollback-profile	q10-q14-1793421934870-rollback-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QRO	1	PUR	1	\N	60	2026-10-31 04:45:35.008	2026-10-31 04:45:35.008
q10-q14-1793421934870-concurrent-profile	q10-q14-1793421934870-concurrent-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 04:45:35.026	2026-10-31 04:45:35.026
q10-q14-1793421934870-conflicting-profile	q10-q14-1793421934870-conflicting-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 04:45:35.047	2026-10-31 04:45:35.047
q10-q14-1793428172549-a-profile	q10-q14-1793428172549-a-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QA	1	PUR	1	\N	60	2026-10-31 06:29:32.66	2026-10-31 06:29:32.66
q10-q14-1793428172549-b-profile	q10-q14-1793428172549-b-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QB	1	PUR	1	\N	60	2026-10-31 06:29:32.707	2026-10-31 06:29:32.707
q10-q14-1793428172549-uncertain-profile	q10-q14-1793428172549-uncertain-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QUN	1	PUR	1	\N	60	2026-10-31 06:29:32.813	2026-10-31 06:29:32.813
q10-q14-1793428172549-rollback-profile	q10-q14-1793428172549-rollback-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QRO	1	PUR	1	\N	60	2026-10-31 06:29:32.882	2026-10-31 06:29:32.882
q10-q14-1793428172549-concurrent-profile	q10-q14-1793428172549-concurrent-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 06:29:32.931	2026-10-31 06:29:32.931
q10-q14-1793428172549-conflicting-profile	q10-q14-1793428172549-conflicting-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 06:29:32.989	2026-10-31 06:29:32.989
q10-q14-1793428213936-a-profile	q10-q14-1793428213936-a-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QA	1	PUR	1	\N	60	2026-10-31 06:30:14.025	2026-10-31 06:30:14.025
q10-q14-1793428213936-b-profile	q10-q14-1793428213936-b-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QB	1	PUR	1	\N	60	2026-10-31 06:30:14.06	2026-10-31 06:30:14.06
q10-q14-1793428213936-uncertain-profile	q10-q14-1793428213936-uncertain-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QUN	1	PUR	1	\N	60	2026-10-31 06:30:14.142	2026-10-31 06:30:14.142
q10-q14-1793428213936-rollback-profile	q10-q14-1793428213936-rollback-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QRO	1	PUR	1	\N	60	2026-10-31 06:30:14.193	2026-10-31 06:30:14.193
q10-q14-1793428213936-concurrent-profile	q10-q14-1793428213936-concurrent-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 06:30:14.226	2026-10-31 06:30:14.226
q10-q14-1793428213936-conflicting-profile	q10-q14-1793428213936-conflicting-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 06:30:14.264	2026-10-31 06:30:14.264
q10-app-1793446286377-profile	q10-app-1793446286377-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QAPP	1	PUR	1	\N	60	2026-10-31 11:31:26.379	2026-10-31 11:31:26.379
q10-app-1793446489184-profile	q10-app-1793446489184-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QAPP	1	PUR	1	\N	60	2026-10-31 11:34:49.185	2026-10-31 11:34:49.185
q10-app-1793446623070-profile	q10-app-1793446623070-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QAPP	1	PUR	1	\N	60	2026-10-31 11:37:03.072	2026-10-31 11:37:03.072
q10-q14-1793446761696-a-profile	q10-q14-1793446761696-a-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QA	1	PUR	1	\N	60	2026-10-31 11:39:21.775	2026-10-31 11:39:21.775
q10-q14-1793446761696-b-profile	q10-q14-1793446761696-b-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QB	1	PUR	1	\N	60	2026-10-31 11:39:21.805	2026-10-31 11:39:21.805
q10-q14-1793446761696-uncertain-profile	q10-q14-1793446761696-uncertain-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QUN	1	PUR	1	\N	60	2026-10-31 11:39:21.875	2026-10-31 11:39:21.875
q10-q14-1793446761696-rollback-profile	q10-q14-1793446761696-rollback-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QRO	1	PUR	1	\N	60	2026-10-31 11:39:21.92	2026-10-31 11:39:21.92
q10-q14-1793446761696-concurrent-profile	q10-q14-1793446761696-concurrent-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 11:39:21.948	2026-10-31 11:39:21.948
q10-q14-1793446761696-conflicting-profile	q10-q14-1793446761696-conflicting-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 11:39:21.986	2026-10-31 11:39:21.986
q10-app-1793447402381-profile	q10-app-1793447402381-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QAPP	1	PUR	1	\N	60	2026-10-31 11:50:02.383	2026-10-31 11:50:02.383
q10-app-1793447603960-profile	q10-app-1793447603960-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QAPP	1	PUR	1	\N	60	2026-10-31 11:53:23.961	2026-10-31 11:53:23.961
q10-q14-1793447682627-a-profile	q10-q14-1793447682627-a-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QA	1	PUR	1	\N	60	2026-10-31 11:54:42.698	2026-10-31 11:54:42.698
q10-q14-1793447682627-b-profile	q10-q14-1793447682627-b-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QB	1	PUR	1	\N	60	2026-10-31 11:54:42.739	2026-10-31 11:54:42.739
q10-q14-1793447682627-uncertain-profile	q10-q14-1793447682627-uncertain-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QUN	1	PUR	1	\N	60	2026-10-31 11:54:42.819	2026-10-31 11:54:42.819
q10-q14-1793447682627-rollback-profile	q10-q14-1793447682627-rollback-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QRO	1	PUR	1	\N	60	2026-10-31 11:54:42.863	2026-10-31 11:54:42.863
q10-q14-1793447682627-concurrent-profile	q10-q14-1793447682627-concurrent-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 11:54:42.897	2026-10-31 11:54:42.897
q10-q14-1793447682627-conflicting-profile	q10-q14-1793447682627-conflicting-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QCO	1	PUR	1	\N	60	2026-10-31 11:54:42.93	2026-10-31 11:54:42.93
q10-app-1793452881250-profile	q10-app-1793452881250-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QAPP	1	PUR	1	\N	60	2026-10-31 13:21:21.252	2026-10-31 13:21:21.252
q10-app-1793453149906-profile	q10-app-1793453149906-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QAPP	1	PUR	1	\N	60	2026-10-31 13:25:49.908	2026-10-31 13:25:49.908
gst_e2e_profile_73ea6c3cef2949eca24441e9e91397c0	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	INV	41	PUR	71	\N	60	2026-10-31 13:29:28.512	2026-10-31 13:29:28.512
gst_e2e_profile_301cc304d3d3444eb59cf3a376f7ecce	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	INV	41	PUR	71	\N	60	2026-10-31 13:29:43.689	2026-10-31 13:29:43.689
gst_e2e_profile_33538e2804724a6896575b28352cb198	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	INV	41	PUR	71	\N	60	2026-10-31 13:29:58.518	2026-10-31 13:29:58.518
gst_e2e_profile_f086c60d09b84c748c245e972ae5f551	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	INV	41	PUR	71	\N	60	2026-10-31 13:30:12.558	2026-10-31 13:30:12.558
gst_e2e_profile_4ac4d77053bd4799930350aa58fe0234	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	INV	41	PUR	71	\N	60	2026-10-31 13:31:24.678	2026-10-31 13:31:24.678
gst_e2e_profile_4ecdb2bb8721431e814a6e19b11d6908	gst_e2e_tenant_19035406820a497699286f211ca126f6	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	INV	41	PUR	71	\N	60	2026-10-31 13:40:27.581	2026-10-31 13:40:27.581
gst_e2e_profile_8f05cfc6fd9a4ded86b326e8d0ed8c7a	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	INV	41	PUR	71	\N	60	2026-10-31 13:32:42.82	2026-10-31 13:32:42.82
q10-app-1793454341866-profile	q10-app-1793454341866-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QAPP	1	PUR	1	\N	60	2026-10-31 13:45:41.869	2026-10-31 13:45:41.869
gst_e2e_profile_c9ac565a80c4453987bd274c00861e31	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	INV	41	PUR	71	\N	60	2026-10-31 13:33:55.958	2026-10-31 13:33:55.958
gst_e2e_profile_073563b7c2334cdab8a61979cdc1f801	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	INV	41	PUR	71	\N	60	2026-10-31 13:41:41.091	2026-10-31 13:41:41.091
gst_e2e_profile_522fdb8e66364da99e2503852fe40b9c	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	INV	41	PUR	71	\N	60	2026-10-31 13:35:09.31	2026-10-31 13:35:09.31
q10-app-1793454409161-profile	q10-app-1793454409161-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QAPP	1	PUR	1	\N	60	2026-10-31 13:46:49.162	2026-10-31 13:46:49.162
gst_e2e_profile_83429dd289e24692a9d8ba9ac38d3956	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	INV	41	PUR	71	\N	60	2026-10-31 13:36:28.408	2026-10-31 13:36:28.408
gst_e2e_profile_83eae2cd53f34e0b8ac62336e0e84342	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	INV	41	PUR	71	\N	60	2026-10-31 13:42:54.027	2026-10-31 13:42:54.027
gst_e2e_profile_3a67c621a1d14bb0b3a514ce7c012a5c	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	INV	41	PUR	71	\N	60	2026-10-31 13:37:50.384	2026-10-31 13:37:50.384
q10-app-1793454491946-profile	q10-app-1793454491946-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QAPP	1	PUR	1	\N	60	2026-10-31 13:48:11.948	2026-10-31 13:48:11.948
gst_e2e_profile_d4d62c80a80b4c3981f7622cff336459	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	INV	41	PUR	71	\N	60	2026-10-31 13:39:14.029	2026-10-31 13:39:14.029
gst_e2e_profile_dd46b51d147e474e8e0ad02011a58cc4	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	INV	41	PUR	71	\N	60	2026-10-31 13:44:31.539	2026-10-31 13:44:31.539
q10-app-1793460716221-profile	q10-app-1793460716221-tenant	\N	\N	\N	MH	\N	India	\N	\N	\N	\N	\N	\N	QAPP	1	PUR	1	\N	60	2026-10-31 15:31:56.222	2026-10-31 15:31:56.222
\.


--
-- Data for Name: customer_ledgers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customer_ledgers (id, tenant_id, customer_id, entry_type, debit, credit, balance, reference_type, reference_id, invoice_id, narration, entry_date, created_at) FROM stdin;
q10-q14-1793420220210-5d2e828e-5eac-49ef-b7f4-641b1a902c0c	q10-q14-1793420220210-a-tenant	q10-q14-1793420220210-a-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793420220210-a-invoice	q10-q14-1793420220210-a-invoice	\N	2026-10-31 04:17:00.344	2026-10-31 04:17:00.344
q10-q14-1793420220210-ffb19419-961a-434c-b70a-96d8f5bc8080	q10-q14-1793420220210-concurrent-tenant	q10-q14-1793420220210-concurrent-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793420220210-concurrent-invoice	q10-q14-1793420220210-concurrent-invoice	\N	2026-10-31 04:17:00.46	2026-10-31 04:17:00.46
q10-q14-1793420355327-57701dc7-1f3d-42fc-b99b-28760e29b00e	q10-q14-1793420355327-a-tenant	q10-q14-1793420355327-a-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793420355327-a-invoice	q10-q14-1793420355327-a-invoice	\N	2026-10-31 04:19:15.443	2026-10-31 04:19:15.443
q10-q14-1793420355327-2d1529ce-6c0a-4f8e-a446-01306daa0df6	q10-q14-1793420355327-uncertain-tenant	q10-q14-1793420355327-uncertain-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793420355327-uncertain-invoice	q10-q14-1793420355327-uncertain-invoice	\N	2026-10-31 04:19:15.485	2026-10-31 04:19:15.485
q10-q14-1793420355327-f9ef2514-576b-4884-8615-6e0c4b877c2e	q10-q14-1793420355327-concurrent-tenant	q10-q14-1793420355327-concurrent-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793420355327-concurrent-invoice	q10-q14-1793420355327-concurrent-invoice	\N	2026-10-31 04:19:15.557	2026-10-31 04:19:15.557
q10-q14-1793420355327-0e96ad72-a161-4d59-8090-9accbc6407f7	q10-q14-1793420355327-conflicting-tenant	q10-q14-1793420355327-conflicting-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793420355327-conflicting-invoice	q10-q14-1793420355327-conflicting-invoice	\N	2026-10-31 04:19:15.591	2026-10-31 04:19:15.591
q10-q14-1793421051032-92b2e926-8486-431d-8ed3-82ef6d920aa0	q10-q14-1793421051032-a-tenant	q10-q14-1793421051032-a-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421051032-a-invoice	q10-q14-1793421051032-a-invoice	\N	2026-10-31 04:30:51.303	2026-10-31 04:30:51.303
q10-q14-1793421051032-5287cacc-b5c5-43f5-920d-5608a54921fc	q10-q14-1793421051032-uncertain-tenant	q10-q14-1793421051032-uncertain-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421051032-uncertain-invoice	q10-q14-1793421051032-uncertain-invoice	\N	2026-10-31 04:30:51.411	2026-10-31 04:30:51.411
q10-q14-1793421051032-2c437771-47e9-4699-9aaf-a9ce9cbf98a6	q10-q14-1793421051032-concurrent-tenant	q10-q14-1793421051032-concurrent-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421051032-concurrent-invoice	q10-q14-1793421051032-concurrent-invoice	\N	2026-10-31 04:30:51.574	2026-10-31 04:30:51.574
q10-q14-1793421051032-8630209e-02bf-4464-8585-890c8901e549	q10-q14-1793421051032-conflicting-tenant	q10-q14-1793421051032-conflicting-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421051032-conflicting-invoice	q10-q14-1793421051032-conflicting-invoice	\N	2026-10-31 04:30:51.639	2026-10-31 04:30:51.639
q10-q14-1793421102644-71aa610d-2b5d-463b-ac93-f2a855e82770	q10-q14-1793421102644-a-tenant	q10-q14-1793421102644-a-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421102644-a-invoice	q10-q14-1793421102644-a-invoice	\N	2026-10-31 04:31:42.794	2026-10-31 04:31:42.794
q10-q14-1793421102644-824a8e49-4ba6-4ea1-81dc-2bf12bc87ec2	q10-q14-1793421102644-uncertain-tenant	q10-q14-1793421102644-uncertain-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421102644-uncertain-invoice	q10-q14-1793421102644-uncertain-invoice	\N	2026-10-31 04:31:42.839	2026-10-31 04:31:42.839
q10-q14-1793421102644-2fa7fe41-567f-48a8-bfca-aa757e65cfe7	q10-q14-1793421102644-concurrent-tenant	q10-q14-1793421102644-concurrent-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421102644-concurrent-invoice	q10-q14-1793421102644-concurrent-invoice	\N	2026-10-31 04:31:42.912	2026-10-31 04:31:42.912
q10-q14-1793421102644-53dfc454-d5e0-4115-aae1-e870d63fc6e6	q10-q14-1793421102644-conflicting-tenant	q10-q14-1793421102644-conflicting-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421102644-conflicting-invoice	q10-q14-1793421102644-conflicting-invoice	\N	2026-10-31 04:31:42.946	2026-10-31 04:31:42.946
q10-q14-1793421202430-edb4bee7-ab2c-4454-9a59-2bbe87f12001	q10-q14-1793421202430-a-tenant	q10-q14-1793421202430-a-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421202430-a-invoice	q10-q14-1793421202430-a-invoice	\N	2026-10-31 04:33:22.648	2026-10-31 04:33:22.648
q10-q14-1793421202430-52aac394-415c-4bff-8283-6b4432f77ba1	q10-q14-1793421202430-uncertain-tenant	q10-q14-1793421202430-uncertain-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421202430-uncertain-invoice	q10-q14-1793421202430-uncertain-invoice	\N	2026-10-31 04:33:22.728	2026-10-31 04:33:22.728
q10-q14-1793421202430-e8889ea9-663b-4c77-8b08-1c76c19f5a01	q10-q14-1793421202430-concurrent-tenant	q10-q14-1793421202430-concurrent-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421202430-concurrent-invoice	q10-q14-1793421202430-concurrent-invoice	\N	2026-10-31 04:33:22.85	2026-10-31 04:33:22.85
q10-q14-1793421202430-eadd5963-8ed3-4962-8524-494be04fea6a	q10-q14-1793421202430-conflicting-tenant	q10-q14-1793421202430-conflicting-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421202430-conflicting-invoice	q10-q14-1793421202430-conflicting-invoice	\N	2026-10-31 04:33:22.906	2026-10-31 04:33:22.906
cmvvwsibh000620j6wi2xfmby	q10-q14-1793421202430-rollback-tenant	q10-q14-1793421202430-rollback-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421202430-rollback-invoice	q10-q14-1793421202430-rollback-invoice	Invoice q10-q14-1793421202430-rollback-draft	2026-10-31 04:33:22.771	2026-10-31 04:36:31.805
q10-q14-1793421457888-8eaac9f9-c61e-4cf7-a233-bdced6f9d331	q10-q14-1793421457888-a-tenant	q10-q14-1793421457888-a-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421457888-a-invoice	q10-q14-1793421457888-a-invoice	\N	2026-10-31 04:37:38.059	2026-10-31 04:37:38.059
q10-q14-1793421457888-aa5f4de0-cc91-494d-bdc0-b509b6b2c3cb	q10-q14-1793421457888-uncertain-tenant	q10-q14-1793421457888-uncertain-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421457888-uncertain-invoice	q10-q14-1793421457888-uncertain-invoice	\N	2026-10-31 04:37:38.114	2026-10-31 04:37:38.114
q10-q14-1793421457888-fdf9d34f-b5e9-4c4e-9e7b-8777655c7ab8	q10-q14-1793421457888-concurrent-tenant	q10-q14-1793421457888-concurrent-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421457888-concurrent-invoice	q10-q14-1793421457888-concurrent-invoice	\N	2026-10-31 04:37:38.198	2026-10-31 04:37:38.198
q10-q14-1793421457888-cc44d67c-b0d0-4136-81bb-58ec0036c26a	q10-q14-1793421457888-conflicting-tenant	q10-q14-1793421457888-conflicting-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421457888-conflicting-invoice	q10-q14-1793421457888-conflicting-invoice	\N	2026-10-31 04:37:38.233	2026-10-31 04:37:38.233
cmvvwtxud000613ymrnrhi5zz	q10-q14-1793421457888-b-tenant	q10-q14-1793421457888-b-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421457888-b-invoice	q10-q14-1793421457888-b-invoice	Invoice q10-q14-1793421457888-b-draft	2026-10-31 04:37:38.019	2026-10-31 04:37:38.58
cmvvwvjae0006d1y2nyy0ocks	q10-q14-1793421457888-rollback-tenant	q10-q14-1793421457888-rollback-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421457888-rollback-invoice	q10-q14-1793421457888-rollback-invoice	Invoice q10-q14-1793421457888-rollback-draft	2026-10-31 04:37:38.14	2026-10-31 04:38:53.029
cmvvwx1ny0006zg7xwpr869e1	q10-q14-1793421202430-b-tenant	q10-q14-1793421202430-b-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421202430-b-invoice	q10-q14-1793421202430-b-invoice	Invoice q10-q14-1793421202430-b-draft	2026-10-31 04:33:22.583	2026-10-31 04:40:03.501
cmvvwzw0c0006docnvptzhbf2	q10-q14-1793421102644-rollback-tenant	q10-q14-1793421102644-rollback-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421102644-rollback-invoice	q10-q14-1793421102644-rollback-invoice	Invoice q10-q14-1793421102644-rollback-draft	2026-10-31 04:31:42.862	2026-10-31 04:42:16.139
cmvvwzw2n000jdocnk4ffyg0g	q10-q14-1793421102644-b-tenant	q10-q14-1793421102644-b-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421102644-b-invoice	q10-q14-1793421102644-b-invoice	Invoice q10-q14-1793421102644-b-draft	2026-10-31 04:31:42.753	2026-10-31 04:42:16.223
cmvvx2prr00069hdl0v50mvzq	q10-q14-1793421051032-rollback-tenant	q10-q14-1793421051032-rollback-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421051032-rollback-invoice	q10-q14-1793421051032-rollback-invoice	Invoice q10-q14-1793421051032-rollback-draft	2026-10-31 04:30:51.468	2026-10-31 04:44:28.023
cmvvx2ptq000j9hdl5ext4t9m	q10-q14-1793421051032-b-tenant	q10-q14-1793421051032-b-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421051032-b-invoice	q10-q14-1793421051032-b-invoice	Invoice q10-q14-1793421051032-b-draft	2026-10-31 04:30:51.203	2026-10-31 04:44:28.093
q10-q14-1793421934870-f5f83d2c-8dd7-4bd7-a3d0-94df3c6ab7bd	q10-q14-1793421934870-a-tenant	q10-q14-1793421934870-a-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421934870-a-invoice	q10-q14-1793421934870-a-invoice	\N	2026-10-31 04:45:34.968	2026-10-31 04:45:34.968
q10-q14-1793421934870-8f8b584a-e4c0-4ea7-82b6-851c08eccc57	q10-q14-1793421934870-uncertain-tenant	q10-q14-1793421934870-uncertain-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421934870-uncertain-invoice	q10-q14-1793421934870-uncertain-invoice	\N	2026-10-31 04:45:34.994	2026-10-31 04:45:34.994
q10-q14-1793421934870-3c51954e-8500-45a9-9ac4-7b28d86813cc	q10-q14-1793421934870-concurrent-tenant	q10-q14-1793421934870-concurrent-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421934870-concurrent-invoice	q10-q14-1793421934870-concurrent-invoice	\N	2026-10-31 04:45:35.038	2026-10-31 04:45:35.038
q10-q14-1793421934870-a53706a9-a6bd-431e-982b-1dc4856626ba	q10-q14-1793421934870-conflicting-tenant	q10-q14-1793421934870-conflicting-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421934870-conflicting-invoice	q10-q14-1793421934870-conflicting-invoice	\N	2026-10-31 04:45:35.058	2026-10-31 04:45:35.058
cmvvx460400064b8g6tmtqtm4	q10-q14-1793421934870-rollback-tenant	q10-q14-1793421934870-rollback-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421934870-rollback-invoice	q10-q14-1793421934870-rollback-invoice	Invoice q10-q14-1793421934870-rollback-draft	2026-10-31 04:45:35.008	2026-10-31 04:45:35.715
cmvvx461f000j4b8g4fh9vhx2	q10-q14-1793421934870-b-tenant	q10-q14-1793421934870-b-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793421934870-b-invoice	q10-q14-1793421934870-b-invoice	Invoice q10-q14-1793421934870-b-draft	2026-10-31 04:45:34.942	2026-10-31 04:45:35.762
q10-q14-1793428172549-86c2fea5-6083-4cef-aba7-c6e3250a1bf4	q10-q14-1793428172549-a-tenant	q10-q14-1793428172549-a-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793428172549-a-invoice	q10-q14-1793428172549-a-invoice	\N	2026-10-31 06:29:32.77	2026-10-31 06:29:32.77
q10-q14-1793428172549-e542eb9f-1670-4b08-9e27-056e410b633f	q10-q14-1793428172549-uncertain-tenant	q10-q14-1793428172549-uncertain-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793428172549-uncertain-invoice	q10-q14-1793428172549-uncertain-invoice	\N	2026-10-31 06:29:32.842	2026-10-31 06:29:32.842
q10-q14-1793428172549-21dabe6e-996a-4bd2-a8d5-344e53ef594c	q10-q14-1793428172549-concurrent-tenant	q10-q14-1793428172549-concurrent-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793428172549-concurrent-invoice	q10-q14-1793428172549-concurrent-invoice	\N	2026-10-31 06:29:32.962	2026-10-31 06:29:32.962
q10-q14-1793428172549-5d514137-fcb6-4e36-8f1d-bd7dbea07928	q10-q14-1793428172549-conflicting-tenant	q10-q14-1793428172549-conflicting-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793428172549-conflicting-invoice	q10-q14-1793428172549-conflicting-invoice	\N	2026-10-31 06:29:33.014	2026-10-31 06:29:33.014
q10-q14-1793428213936-d0dfbc7f-7ad7-4760-8303-2b191103781e	q10-q14-1793428213936-a-tenant	q10-q14-1793428213936-a-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793428213936-a-invoice	q10-q14-1793428213936-a-invoice	\N	2026-10-31 06:30:14.11	2026-10-31 06:30:14.11
q10-q14-1793428213936-8b7fb410-1658-49a1-9c37-5b88cacc73f7	q10-q14-1793428213936-uncertain-tenant	q10-q14-1793428213936-uncertain-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793428213936-uncertain-invoice	q10-q14-1793428213936-uncertain-invoice	\N	2026-10-31 06:30:14.16	2026-10-31 06:30:14.16
q10-q14-1793428213936-1c40db09-10cc-4ca2-b536-93c88cb841a7	q10-q14-1793428213936-concurrent-tenant	q10-q14-1793428213936-concurrent-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793428213936-concurrent-invoice	q10-q14-1793428213936-concurrent-invoice	\N	2026-10-31 06:30:14.246	2026-10-31 06:30:14.246
q10-q14-1793428213936-4677bc08-c9ce-43be-ab5a-b2e662117997	q10-q14-1793428213936-conflicting-tenant	q10-q14-1793428213936-conflicting-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793428213936-conflicting-invoice	q10-q14-1793428213936-conflicting-invoice	\N	2026-10-31 06:30:14.284	2026-10-31 06:30:14.284
cmvwazxk70006ujqzhxp2npk1	q10-q14-1793428213936-rollback-tenant	q10-q14-1793428213936-rollback-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793428213936-rollback-invoice	q10-q14-1793428213936-rollback-invoice	Invoice q10-q14-1793428213936-rollback-draft	2026-10-31 06:30:14.193	2026-10-31 11:14:12.774
cmvwazxlo000jujqzd4hxxeok	q10-q14-1793428213936-b-tenant	q10-q14-1793428213936-b-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793428213936-b-invoice	q10-q14-1793428213936-b-invoice	Invoice q10-q14-1793428213936-b-draft	2026-10-31 06:30:14.06	2026-10-31 11:14:12.827
cmvwbfxof0006xur6yg964q9n	q10-q14-1793428172549-rollback-tenant	q10-q14-1793428172549-rollback-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793428172549-rollback-invoice	q10-q14-1793428172549-rollback-invoice	Invoice q10-q14-1793428172549-rollback-draft	2026-10-31 06:29:32.882	2026-10-31 11:26:39.421
cmvwbkhrc0006t34w4tjj7ejy	q10-q14-1793428172549-b-tenant	q10-q14-1793428172549-b-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793428172549-b-invoice	q10-q14-1793428172549-b-invoice	Invoice q10-q14-1793428172549-b-draft	2026-10-31 06:29:32.707	2026-10-31 11:30:12.071
cmvwbm3h70006a8p27s9ms7th	q10-app-1793446286377-tenant	q10-app-1793446286377-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-app-1793446286377-invoice-0	q10-app-1793446286377-invoice-0	Invoice q10-app-1793446286377-draft-0	2026-10-31 11:31:26.379	2026-10-31 11:31:26.875
cmvwbm3s6000ka8p2ad9yxljd	q10-app-1793446286377-tenant	q10-app-1793446286377-customer	INVOICE	118.00	0.00	236.00	sales_invoice	q10-app-1793446286377-invoice-1	q10-app-1793446286377-invoice-1	Invoice q10-app-1793446286377-draft-1	2026-10-31 11:31:26.379	2026-10-31 11:31:27.27
cmvwbqfyu0006ic7x49q8focn	q10-app-1793446489184-tenant	q10-app-1793446489184-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-app-1793446489184-invoice-0	q10-app-1793446489184-invoice-0	Invoice q10-app-1793446489184-draft-0	2026-10-31 11:34:49.185	2026-10-31 11:34:49.685
cmvwbqg9j000kic7xg2fevye4	q10-app-1793446489184-tenant	q10-app-1793446489184-customer	INVOICE	118.00	0.00	236.00	sales_invoice	q10-app-1793446489184-invoice-1	q10-app-1793446489184-invoice-1	Invoice q10-app-1793446489184-draft-1	2026-10-31 11:34:49.185	2026-10-31 11:34:50.07
cmvwbtbfe0006klje6a4xk8bq	q10-app-1793446623070-tenant	q10-app-1793446623070-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-app-1793446623070-invoice-0	q10-app-1793446623070-invoice-0	Invoice q10-app-1793446623070-draft-0	2026-10-31 11:37:03.072	2026-10-31 11:37:03.769
cmvwbtbq6000kkljemx3q9nge	q10-app-1793446623070-tenant	q10-app-1793446623070-customer	INVOICE	118.00	0.00	236.00	sales_invoice	q10-app-1793446623070-invoice-1	q10-app-1793446623070-invoice-1	Invoice q10-app-1793446623070-draft-1	2026-10-31 11:37:03.072	2026-10-31 11:37:04.158
q10-q14-1793446761696-cf74b556-3f3e-4206-8467-0ea27623de43	q10-q14-1793446761696-a-tenant	q10-q14-1793446761696-a-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793446761696-a-invoice	q10-q14-1793446761696-a-invoice	\N	2026-10-31 11:39:21.851	2026-10-31 11:39:21.851
q10-q14-1793446761696-f73d1317-330a-461b-948e-86726a2851bf	q10-q14-1793446761696-uncertain-tenant	q10-q14-1793446761696-uncertain-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793446761696-uncertain-invoice	q10-q14-1793446761696-uncertain-invoice	\N	2026-10-31 11:39:21.891	2026-10-31 11:39:21.891
q10-q14-1793446761696-6e43b575-0bdc-443d-921e-13f575442439	q10-q14-1793446761696-concurrent-tenant	q10-q14-1793446761696-concurrent-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793446761696-concurrent-invoice	q10-q14-1793446761696-concurrent-invoice	\N	2026-10-31 11:39:21.967	2026-10-31 11:39:21.967
q10-q14-1793446761696-08f7c292-2df2-43fe-91fe-d32d8ab3d670	q10-q14-1793446761696-conflicting-tenant	q10-q14-1793446761696-conflicting-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793446761696-conflicting-invoice	q10-q14-1793446761696-conflicting-invoice	\N	2026-10-31 11:39:22.009	2026-10-31 11:39:22.009
cmvwcec4100065hhtlp78z6la	q10-app-1793447603960-tenant	q10-app-1793447603960-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-app-1793447603960-invoice-0	q10-app-1793447603960-invoice-0	Invoice q10-app-1793447603960-draft-0	2026-10-31 11:53:23.961	2026-10-31 11:53:24.433
cmvwcecem000i5hhtokkzbzoy	q10-app-1793447603960-tenant	q10-app-1793447603960-customer	INVOICE	118.00	0.00	236.00	sales_invoice	q10-app-1793447603960-invoice-1	q10-app-1793447603960-invoice-1	Invoice q10-app-1793447603960-draft-1	2026-10-31 11:53:23.961	2026-10-31 11:53:24.814
q10-q14-1793447682627-1f7e3db6-3471-4d42-b658-f80cf5468b2e	q10-q14-1793447682627-a-tenant	q10-q14-1793447682627-a-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793447682627-a-invoice	q10-q14-1793447682627-a-invoice	\N	2026-10-31 11:54:42.794	2026-10-31 11:54:42.794
q10-q14-1793447682627-ac22e8c4-cb4c-4ddb-b044-d24e78d08af9	q10-q14-1793447682627-uncertain-tenant	q10-q14-1793447682627-uncertain-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793447682627-uncertain-invoice	q10-q14-1793447682627-uncertain-invoice	\N	2026-10-31 11:54:42.838	2026-10-31 11:54:42.838
q10-q14-1793447682627-bef19cf6-5434-4ff5-8db4-36c1bc5416fa	q10-q14-1793447682627-concurrent-tenant	q10-q14-1793447682627-concurrent-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793447682627-concurrent-invoice	q10-q14-1793447682627-concurrent-invoice	\N	2026-10-31 11:54:42.915	2026-10-31 11:54:42.915
q10-q14-1793447682627-d9edd1cf-ca86-4f96-ab22-a2b04107714b	q10-q14-1793447682627-conflicting-tenant	q10-q14-1793447682627-conflicting-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-q14-1793447682627-conflicting-invoice	q10-q14-1793447682627-conflicting-invoice	\N	2026-10-31 11:54:42.947	2026-10-31 11:54:42.947
cmvwfjgfs0006nht7ddnhlqoc	q10-app-1793452881250-tenant	q10-app-1793452881250-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-app-1793452881250-invoice-0	q10-app-1793452881250-invoice-0	Invoice q10-app-1793452881250-draft-0	2026-10-31 13:21:21.252	2026-10-31 13:21:22.168
cmvwfjgs7000inht720vjozlq	q10-app-1793452881250-tenant	q10-app-1793452881250-customer	INVOICE	118.00	0.00	236.00	sales_invoice	q10-app-1793452881250-invoice-1	q10-app-1793452881250-invoice-1	Invoice q10-app-1793452881250-draft-1	2026-10-31 13:21:21.252	2026-10-31 13:21:22.614
cmvwfp7ye0006axyml3uph1sw	q10-app-1793453149906-tenant	q10-app-1793453149906-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-app-1793453149906-invoice-0	q10-app-1793453149906-invoice-0	Invoice q10-app-1793453149906-draft-0	2026-10-31 13:25:49.908	2026-10-31 13:25:51.109
cmvwfp8d1000iaxym7oql7asa	q10-app-1793453149906-tenant	q10-app-1793453149906-customer	INVOICE	118.00	0.00	236.00	sales_invoice	q10-app-1793453149906-invoice-1	q10-app-1793453149906-invoice-1	Invoice q10-app-1793453149906-draft-1	2026-10-31 13:25:49.908	2026-10-31 13:25:51.636
cmvwfy2sq000i99yr4rftjbix	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_customer_9fb72d8b5cc547d9977e7768ff0eb3e1	INVOICE	118.00	0.00	368.00	sales_invoice	gst_e2e_sales_success_c9722d460e8a47f6916e516454354bd4	gst_e2e_sales_success_c9722d460e8a47f6916e516454354bd4	Invoice DRAFT-54354bd4	2026-10-31 13:32:42.82	2026-10-31 13:32:44.326
cmvwfzn8k000iza3tbefxfjqm	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_customer_9c8f6b6af650473ca0686bf93bdf5f8a	INVOICE	118.00	0.00	368.00	sales_invoice	gst_e2e_sales_success_0708541c7aef4e43a298df5fa0fa77e1	gst_e2e_sales_success_0708541c7aef4e43a298df5fa0fa77e1	Invoice DRAFT-a0fa77e1	2026-10-31 13:33:55.958	2026-10-31 13:33:57.476
cmvwg17sj000ilgotxbm9qgdq	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_customer_f7ec09f1760f449e8366f9a0a944e1cb	INVOICE	118.00	0.00	368.00	sales_invoice	gst_e2e_sales_success_afdbc6d5a3564cca92e3383e1fbd7e74	gst_e2e_sales_success_afdbc6d5a3564cca92e3383e1fbd7e74	Invoice DRAFT-1fbd7e74	2026-10-31 13:35:09.31	2026-10-31 13:35:10.77
cmvwg2x3d000i2plhww0pmuss	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_customer_e7c7720acc5640c7a49b41af5d65f7ba	INVOICE	118.00	0.00	368.00	sales_invoice	gst_e2e_sales_success_4c9c04755904459bba454f3edc4a0120	gst_e2e_sales_success_4c9c04755904459bba454f3edc4a0120	Invoice DRAFT-dc4a0120	2026-10-31 13:36:28.408	2026-10-31 13:36:30.216
cmvwg4nwi000i14oz2h7lny6e	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_customer_a21a9ba9d65143f28e834e3ab190721a	INVOICE	118.00	0.00	368.00	sales_invoice	gst_e2e_sales_success_76727966456547758e6f567b024f8d91	gst_e2e_sales_success_76727966456547758e6f567b024f8d91	Invoice DRAFT-024f8d91	2026-10-31 13:37:50.384	2026-10-31 13:37:51.618
cmvwg6giu000ikez5ypug7dqp	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_customer_8ddd37d3f7b44572b56a8478c4adec59	INVOICE	118.00	0.00	368.00	sales_invoice	gst_e2e_sales_success_9e5c4bd6a06442659dae4570dd904250	gst_e2e_sales_success_9e5c4bd6a06442659dae4570dd904250	Invoice DRAFT-dd904250	2026-10-31 13:39:14.029	2026-10-31 13:39:15.365
cmvwg6gpr0011kez5zcrpfior	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_customer_8ddd37d3f7b44572b56a8478c4adec59	PAYMENT_RECEIVED	0.00	50.00	318.00	payment_received	\N	\N	Payment received — Cash #GST-gst_e2e_sales_success_9e5c4bd6a06442659dae4570dd904250	2026-10-31 13:39:15.6	2026-10-31 13:39:15.614
cmvwg818i000iemkistftrbni	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_customer_f56e9da2dcea4246bca746695a7dea4e	INVOICE	118.00	0.00	368.00	sales_invoice	gst_e2e_sales_success_861a943099ab401896b2cf2663424588	gst_e2e_sales_success_861a943099ab401896b2cf2663424588	Invoice DRAFT-63424588	2026-10-31 13:40:27.581	2026-10-31 13:40:28.865
cmvwg81h00011emkiu0tj1ekh	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_customer_f56e9da2dcea4246bca746695a7dea4e	PAYMENT_RECEIVED	0.00	50.00	318.00	payment_received	\N	\N	Payment received — Cash #GST-gst_e2e_sales_success_861a943099ab401896b2cf2663424588	2026-10-31 13:40:29.158	2026-10-31 13:40:29.171
cmvwg9m96000idaac5s45jp4n	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_customer_9cc2dac0526449ffbd1ddcf488281125	INVOICE	118.00	0.00	368.00	sales_invoice	gst_e2e_sales_success_ad360a6411064d099a18d08fa4bf62c4	gst_e2e_sales_success_ad360a6411064d099a18d08fa4bf62c4	Invoice DRAFT-a4bf62c4	2026-10-31 13:41:41.091	2026-10-31 13:41:42.761
cmvwg9mha0011daac473jcn3c	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_customer_9cc2dac0526449ffbd1ddcf488281125	PAYMENT_RECEIVED	0.00	50.00	318.00	payment_received	\N	\N	Payment received — Cash #GST-gst_e2e_sales_success_ad360a6411064d099a18d08fa4bf62c4	2026-10-31 13:41:43.043	2026-10-31 13:41:43.053
cmvwgb6h6000ivg91i0a3talp	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_customer_1009f79da0544b509415c0b38d81b5c6	INVOICE	118.00	0.00	368.00	sales_invoice	gst_e2e_sales_success_b3d1b8d7803746e8a34a24ada270c41d	gst_e2e_sales_success_b3d1b8d7803746e8a34a24ada270c41d	Invoice DRAFT-a270c41d	2026-10-31 13:42:54.027	2026-10-31 13:42:55.625
cmvwgb6r90011vg91aefck4bz	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_customer_1009f79da0544b509415c0b38d81b5c6	PAYMENT_RECEIVED	0.00	50.00	318.00	payment_received	\N	\N	Payment received — Cash #GST-gst_e2e_sales_success_b3d1b8d7803746e8a34a24ada270c41d	2026-10-31 13:42:55.974	2026-10-31 13:42:55.988
cmvwgd9rh000ietes4zpyrwno	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_customer_caf9c8df9ec844819ddb9b8bd1fa5e5a	INVOICE	118.00	0.00	368.00	sales_invoice	gst_e2e_sales_success_e95ec457a9c74f97be29242a8011148c	gst_e2e_sales_success_e95ec457a9c74f97be29242a8011148c	Invoice DRAFT-8011148c	2026-10-31 13:44:31.539	2026-10-31 13:44:33.196
cmvwgda330011etesjmavoahx	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_customer_caf9c8df9ec844819ddb9b8bd1fa5e5a	PAYMENT_RECEIVED	0.00	50.00	318.00	payment_received	\N	\N	Payment received — Cash #GST-gst_e2e_sales_success_e95ec457a9c74f97be29242a8011148c	2026-10-31 13:44:33.592	2026-10-31 13:44:33.611
cmvwgerdq0006payc81c6ztav	q10-app-1793454341866-tenant	q10-app-1793454341866-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-app-1793454341866-invoice-0	q10-app-1793454341866-invoice-0	Invoice q10-app-1793454341866-draft-0	2026-10-31 13:45:41.869	2026-10-31 13:45:42.685
cmvwges22000ipaycwjf9x48k	q10-app-1793454341866-tenant	q10-app-1793454341866-customer	INVOICE	118.00	0.00	236.00	sales_invoice	q10-app-1793454341866-invoice-1	q10-app-1793454341866-invoice-1	Invoice q10-app-1793454341866-draft-1	2026-10-31 13:45:41.869	2026-10-31 13:45:43.561
cmvwgg78n00062ruvfqgoxv5j	q10-app-1793454409161-tenant	q10-app-1793454409161-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-app-1793454409161-invoice-0	q10-app-1793454409161-invoice-0	Invoice q10-app-1793454409161-draft-0	2026-10-31 13:46:49.162	2026-10-31 13:46:49.894
cmvwgg7u1000i2ruvsmowwi1j	q10-app-1793454409161-tenant	q10-app-1793454409161-customer	INVOICE	118.00	0.00	236.00	sales_invoice	q10-app-1793454409161-invoice-1	q10-app-1793454409161-invoice-1	Invoice q10-app-1793454409161-draft-1	2026-10-31 13:46:49.162	2026-10-31 13:46:50.664
cmvwghz6s0006jrg06wiwr9is	q10-app-1793454491946-tenant	q10-app-1793454491946-customer	INVOICE	118.00	0.00	118.00	sales_invoice	q10-app-1793454491946-invoice-0	q10-app-1793454491946-invoice-0	Invoice q10-app-1793454491946-draft-0	2026-10-31 13:48:11.948	2026-10-31 13:48:12.772
cmvwghzit000ijrg00io67td8	q10-app-1793454491946-tenant	q10-app-1793454491946-customer	INVOICE	118.00	0.00	236.00	sales_invoice	q10-app-1793454491946-invoice-1	q10-app-1793454491946-invoice-1	Invoice q10-app-1793454491946-draft-1	2026-10-31 13:48:11.948	2026-10-31 13:48:13.204
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customers (id, tenant_id, code, business_name, contact_person, phone, mobile, email, billing_address_1, billing_address_2, billing_city, billing_state, billing_pincode, gstin, drug_license_no_1, drug_license_no_2, credit_limit, opening_balance, receivable_balance, is_active, created_at, updated_at) FROM stdin;
q10-q14-1793420207911-a-customer	q10-q14-1793420207911-a-tenant	\N	Synthetic Customer a	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:16:47.969	2026-10-31 04:16:47.969
q10-q14-1793420207911-b-customer	q10-q14-1793420207911-b-tenant	\N	Synthetic Customer b	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:16:48.008	2026-10-31 04:16:48.008
q10-q14-1793420214519-a-customer	q10-q14-1793420214519-a-tenant	\N	Synthetic Customer a	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:16:54.574	2026-10-31 04:16:54.574
q10-q14-1793420214519-b-customer	q10-q14-1793420214519-b-tenant	\N	Synthetic Customer b	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:16:54.615	2026-10-31 04:16:54.615
q10-q14-1793420220210-a-customer	q10-q14-1793420220210-a-tenant	\N	Synthetic Customer a	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:17:00.268	2026-10-31 04:17:00.268
q10-q14-1793420220210-b-customer	q10-q14-1793420220210-b-tenant	\N	Synthetic Customer b	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:17:00.306	2026-10-31 04:17:00.306
q10-q14-1793420220210-rollback-customer	q10-q14-1793420220210-rollback-tenant	\N	Synthetic Customer rollback	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:17:00.393	2026-10-31 04:17:00.393
q10-q14-1793420220210-concurrent-customer	q10-q14-1793420220210-concurrent-tenant	\N	Synthetic Customer concurrent	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:17:00.434	2026-10-31 04:17:00.434
q10-q14-1793420348045-a-customer	q10-q14-1793420348045-a-tenant	\N	Synthetic Customer a	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:19:08.093	2026-10-31 04:19:08.093
q10-q14-1793420348045-b-customer	q10-q14-1793420348045-b-tenant	\N	Synthetic Customer b	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:19:08.125	2026-10-31 04:19:08.125
q10-q14-1793420355327-a-customer	q10-q14-1793420355327-a-tenant	\N	Synthetic Customer a	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:19:15.377	2026-10-31 04:19:15.377
q10-q14-1793420355327-b-customer	q10-q14-1793420355327-b-tenant	\N	Synthetic Customer b	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:19:15.409	2026-10-31 04:19:15.409
q10-q14-1793420355327-uncertain-customer	q10-q14-1793420355327-uncertain-tenant	\N	Synthetic Customer uncertain	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:19:15.469	2026-10-31 04:19:15.469
q10-q14-1793420355327-rollback-customer	q10-q14-1793420355327-rollback-tenant	\N	Synthetic Customer rollback	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:19:15.508	2026-10-31 04:19:15.508
q10-q14-1793420355327-concurrent-customer	q10-q14-1793420355327-concurrent-tenant	\N	Synthetic Customer concurrent	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:19:15.538	2026-10-31 04:19:15.538
q10-q14-1793420355327-conflicting-customer	q10-q14-1793420355327-conflicting-tenant	\N	Synthetic Customer conflicting	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:19:15.573	2026-10-31 04:19:15.573
q10-q14-1793421051032-a-customer	q10-q14-1793421051032-a-tenant	\N	Synthetic Customer a	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:30:51.126	2026-10-31 04:30:51.126
q10-q14-1793421051032-uncertain-customer	q10-q14-1793421051032-uncertain-tenant	\N	Synthetic Customer uncertain	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:30:51.365	2026-10-31 04:30:51.365
q10-q14-1793421051032-concurrent-customer	q10-q14-1793421051032-concurrent-tenant	\N	Synthetic Customer concurrent	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:30:51.534	2026-10-31 04:30:51.534
q10-q14-1793421051032-conflicting-customer	q10-q14-1793421051032-conflicting-tenant	\N	Synthetic Customer conflicting	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:30:51.605	2026-10-31 04:30:51.605
q10-q14-1793421102644-a-customer	q10-q14-1793421102644-a-tenant	\N	Synthetic Customer a	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:31:42.721	2026-10-31 04:31:42.721
q10-q14-1793421102644-uncertain-customer	q10-q14-1793421102644-uncertain-tenant	\N	Synthetic Customer uncertain	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:31:42.822	2026-10-31 04:31:42.822
q10-q14-1793421102644-concurrent-customer	q10-q14-1793421102644-concurrent-tenant	\N	Synthetic Customer concurrent	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:31:42.892	2026-10-31 04:31:42.892
q10-q14-1793421102644-conflicting-customer	q10-q14-1793421102644-conflicting-tenant	\N	Synthetic Customer conflicting	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:31:42.928	2026-10-31 04:31:42.928
q10-q14-1793421202430-a-customer	q10-q14-1793421202430-a-tenant	\N	Synthetic Customer a	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:33:22.534	2026-10-31 04:33:22.534
q10-q14-1793421202430-uncertain-customer	q10-q14-1793421202430-uncertain-tenant	\N	Synthetic Customer uncertain	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:33:22.696	2026-10-31 04:33:22.696
q10-q14-1793421202430-concurrent-customer	q10-q14-1793421202430-concurrent-tenant	\N	Synthetic Customer concurrent	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:33:22.819	2026-10-31 04:33:22.819
q10-q14-1793421202430-conflicting-customer	q10-q14-1793421202430-conflicting-tenant	\N	Synthetic Customer conflicting	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:33:22.877	2026-10-31 04:33:22.877
q10-q14-1793421202430-rollback-customer	q10-q14-1793421202430-rollback-tenant	\N	Synthetic Customer rollback	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	118.00	t	2026-10-31 04:33:22.771	2026-10-31 04:36:31.808
q10-q14-1793421457888-a-customer	q10-q14-1793421457888-a-tenant	\N	Synthetic Customer a	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:37:37.984	2026-10-31 04:37:37.984
q10-q14-1793421457888-uncertain-customer	q10-q14-1793421457888-uncertain-tenant	\N	Synthetic Customer uncertain	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:37:38.092	2026-10-31 04:37:38.092
q10-q14-1793421457888-concurrent-customer	q10-q14-1793421457888-concurrent-tenant	\N	Synthetic Customer concurrent	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:37:38.176	2026-10-31 04:37:38.176
q10-q14-1793421457888-conflicting-customer	q10-q14-1793421457888-conflicting-tenant	\N	Synthetic Customer conflicting	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:37:38.215	2026-10-31 04:37:38.215
q10-q14-1793421457888-b-customer	q10-q14-1793421457888-b-tenant	\N	Synthetic Customer b	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	118.00	t	2026-10-31 04:37:38.019	2026-10-31 04:37:38.584
q10-q14-1793421457888-rollback-customer	q10-q14-1793421457888-rollback-tenant	\N	Synthetic Customer rollback	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	118.00	t	2026-10-31 04:37:38.14	2026-10-31 04:38:53.033
q10-q14-1793421202430-b-customer	q10-q14-1793421202430-b-tenant	\N	Synthetic Customer b	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	118.00	t	2026-10-31 04:33:22.583	2026-10-31 04:40:03.504
q10-q14-1793421102644-rollback-customer	q10-q14-1793421102644-rollback-tenant	\N	Synthetic Customer rollback	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	118.00	t	2026-10-31 04:31:42.862	2026-10-31 04:42:16.143
q10-q14-1793421102644-b-customer	q10-q14-1793421102644-b-tenant	\N	Synthetic Customer b	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	118.00	t	2026-10-31 04:31:42.753	2026-10-31 04:42:16.226
q10-q14-1793421051032-rollback-customer	q10-q14-1793421051032-rollback-tenant	\N	Synthetic Customer rollback	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	118.00	t	2026-10-31 04:30:51.468	2026-10-31 04:44:28.026
q10-q14-1793421051032-b-customer	q10-q14-1793421051032-b-tenant	\N	Synthetic Customer b	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	118.00	t	2026-10-31 04:30:51.203	2026-10-31 04:44:28.096
q10-q14-1793421934870-a-customer	q10-q14-1793421934870-a-tenant	\N	Synthetic Customer a	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:45:34.921	2026-10-31 04:45:34.921
q10-q14-1793421934870-uncertain-customer	q10-q14-1793421934870-uncertain-tenant	\N	Synthetic Customer uncertain	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:45:34.984	2026-10-31 04:45:34.984
q10-q14-1793421934870-concurrent-customer	q10-q14-1793421934870-concurrent-tenant	\N	Synthetic Customer concurrent	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:45:35.026	2026-10-31 04:45:35.026
q10-q14-1793421934870-conflicting-customer	q10-q14-1793421934870-conflicting-tenant	\N	Synthetic Customer conflicting	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 04:45:35.047	2026-10-31 04:45:35.047
q10-q14-1793421934870-rollback-customer	q10-q14-1793421934870-rollback-tenant	\N	Synthetic Customer rollback	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	118.00	t	2026-10-31 04:45:35.008	2026-10-31 04:45:35.718
q10-q14-1793421934870-b-customer	q10-q14-1793421934870-b-tenant	\N	Synthetic Customer b	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	118.00	t	2026-10-31 04:45:34.942	2026-10-31 04:45:35.764
q10-q14-1793428172549-a-customer	q10-q14-1793428172549-a-tenant	\N	Synthetic Customer a	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 06:29:32.66	2026-10-31 06:29:32.66
q10-q14-1793428172549-uncertain-customer	q10-q14-1793428172549-uncertain-tenant	\N	Synthetic Customer uncertain	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 06:29:32.813	2026-10-31 06:29:32.813
q10-q14-1793428172549-b-customer	q10-q14-1793428172549-b-tenant	\N	Synthetic Customer b	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	118.00	t	2026-10-31 06:29:32.707	2026-10-31 11:30:12.075
q10-q14-1793428172549-concurrent-customer	q10-q14-1793428172549-concurrent-tenant	\N	Synthetic Customer concurrent	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 06:29:32.931	2026-10-31 06:29:32.931
q10-q14-1793428172549-conflicting-customer	q10-q14-1793428172549-conflicting-tenant	\N	Synthetic Customer conflicting	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 06:29:32.989	2026-10-31 06:29:32.989
q10-q14-1793428213936-a-customer	q10-q14-1793428213936-a-tenant	\N	Synthetic Customer a	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 06:30:14.025	2026-10-31 06:30:14.025
q10-q14-1793428213936-uncertain-customer	q10-q14-1793428213936-uncertain-tenant	\N	Synthetic Customer uncertain	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 06:30:14.142	2026-10-31 06:30:14.142
q10-q14-1793428213936-concurrent-customer	q10-q14-1793428213936-concurrent-tenant	\N	Synthetic Customer concurrent	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 06:30:14.226	2026-10-31 06:30:14.226
q10-q14-1793428213936-conflicting-customer	q10-q14-1793428213936-conflicting-tenant	\N	Synthetic Customer conflicting	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 06:30:14.264	2026-10-31 06:30:14.264
q10-q14-1793428213936-rollback-customer	q10-q14-1793428213936-rollback-tenant	\N	Synthetic Customer rollback	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	118.00	t	2026-10-31 06:30:14.193	2026-10-31 11:14:12.778
q10-q14-1793428213936-b-customer	q10-q14-1793428213936-b-tenant	\N	Synthetic Customer b	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	118.00	t	2026-10-31 06:30:14.06	2026-10-31 11:14:12.829
q10-q14-1793428172549-rollback-customer	q10-q14-1793428172549-rollback-tenant	\N	Synthetic Customer rollback	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	118.00	t	2026-10-31 06:29:32.882	2026-10-31 11:26:39.428
gst_e2e_customer_d38392d3367a4e9a8e9439a1786fe2c4	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	\N	GST Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	250.00	t	2026-10-31 13:31:24.678	2026-10-31 13:31:24.678
q10-app-1793446286377-customer	q10-app-1793446286377-tenant	\N	Q10 Application Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	236.00	t	2026-10-31 11:31:26.379	2026-10-31 11:31:27.272
q10-app-1793446489184-customer	q10-app-1793446489184-tenant	\N	Q10 Application Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	236.00	t	2026-10-31 11:34:49.185	2026-10-31 11:34:50.076
gst_e2e_customer_9fb72d8b5cc547d9977e7768ff0eb3e1	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	\N	GST Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	368.00	t	2026-10-31 13:32:42.82	2026-10-31 13:32:44.334
q10-app-1793446623070-customer	q10-app-1793446623070-tenant	\N	Q10 Application Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	236.00	t	2026-10-31 11:37:03.072	2026-10-31 11:37:04.161
q10-q14-1793446761696-a-customer	q10-q14-1793446761696-a-tenant	\N	Synthetic Customer a	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 11:39:21.775	2026-10-31 11:39:21.775
q10-q14-1793446761696-b-customer	q10-q14-1793446761696-b-tenant	\N	Synthetic Customer b	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 11:39:21.805	2026-10-31 11:39:21.805
q10-q14-1793446761696-uncertain-customer	q10-q14-1793446761696-uncertain-tenant	\N	Synthetic Customer uncertain	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 11:39:21.875	2026-10-31 11:39:21.875
q10-q14-1793446761696-rollback-customer	q10-q14-1793446761696-rollback-tenant	\N	Synthetic Customer rollback	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 11:39:21.92	2026-10-31 11:39:21.92
q10-q14-1793446761696-concurrent-customer	q10-q14-1793446761696-concurrent-tenant	\N	Synthetic Customer concurrent	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 11:39:21.948	2026-10-31 11:39:21.948
q10-q14-1793446761696-conflicting-customer	q10-q14-1793446761696-conflicting-tenant	\N	Synthetic Customer conflicting	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 11:39:21.986	2026-10-31 11:39:21.986
q10-app-1793447402381-customer	q10-app-1793447402381-tenant	\N	Q10 Application Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 11:50:02.383	2026-10-31 11:50:02.383
q10-app-1793447603960-customer	q10-app-1793447603960-tenant	\N	Q10 Application Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	236.00	t	2026-10-31 11:53:23.961	2026-10-31 11:53:24.817
q10-q14-1793447682627-a-customer	q10-q14-1793447682627-a-tenant	\N	Synthetic Customer a	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 11:54:42.698	2026-10-31 11:54:42.698
q10-q14-1793447682627-b-customer	q10-q14-1793447682627-b-tenant	\N	Synthetic Customer b	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 11:54:42.739	2026-10-31 11:54:42.739
q10-q14-1793447682627-uncertain-customer	q10-q14-1793447682627-uncertain-tenant	\N	Synthetic Customer uncertain	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 11:54:42.819	2026-10-31 11:54:42.819
q10-q14-1793447682627-rollback-customer	q10-q14-1793447682627-rollback-tenant	\N	Synthetic Customer rollback	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 11:54:42.863	2026-10-31 11:54:42.863
q10-q14-1793447682627-concurrent-customer	q10-q14-1793447682627-concurrent-tenant	\N	Synthetic Customer concurrent	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 11:54:42.897	2026-10-31 11:54:42.897
q10-q14-1793447682627-conflicting-customer	q10-q14-1793447682627-conflicting-tenant	\N	Synthetic Customer conflicting	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 11:54:42.93	2026-10-31 11:54:42.93
gst_e2e_customer_9c8f6b6af650473ca0686bf93bdf5f8a	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	\N	GST Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	368.00	t	2026-10-31 13:33:55.958	2026-10-31 13:33:57.481
q10-app-1793452881250-customer	q10-app-1793452881250-tenant	\N	Q10 Application Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	236.00	t	2026-10-31 13:21:21.252	2026-10-31 13:21:22.618
q10-app-1793453149906-customer	q10-app-1793453149906-tenant	\N	Q10 Application Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	236.00	t	2026-10-31 13:25:49.908	2026-10-31 13:25:51.641
gst_e2e_customer_c4436139548d46c6a24242f8181f1a30	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	\N	GST Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	250.00	t	2026-10-31 13:29:28.512	2026-10-31 13:29:28.512
gst_e2e_customer_dea834df00974cf59a8075e1de47eccc	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	\N	GST Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	250.00	t	2026-10-31 13:29:43.689	2026-10-31 13:29:43.689
gst_e2e_customer_73fddfc9bbd34e4ea7fdea62a9f84a1e	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	\N	GST Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	250.00	t	2026-10-31 13:29:58.518	2026-10-31 13:29:58.518
gst_e2e_customer_851024189a8e4d35be9004a36792d1cf	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	\N	GST Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	250.00	t	2026-10-31 13:30:12.558	2026-10-31 13:30:12.558
gst_e2e_customer_f7ec09f1760f449e8366f9a0a944e1cb	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	\N	GST Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	368.00	t	2026-10-31 13:35:09.31	2026-10-31 13:35:10.779
gst_e2e_customer_e7c7720acc5640c7a49b41af5d65f7ba	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	\N	GST Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	368.00	t	2026-10-31 13:36:28.408	2026-10-31 13:36:30.222
gst_e2e_customer_a21a9ba9d65143f28e834e3ab190721a	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	\N	GST Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	368.00	t	2026-10-31 13:37:50.384	2026-10-31 13:37:51.621
gst_e2e_customer_8ddd37d3f7b44572b56a8478c4adec59	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	\N	GST Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	318.00	t	2026-10-31 13:39:14.029	2026-10-31 13:39:15.618
gst_e2e_customer_9cc2dac0526449ffbd1ddcf488281125	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	\N	GST Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	318.00	t	2026-10-31 13:41:41.091	2026-10-31 13:41:43.059
gst_e2e_customer_f56e9da2dcea4246bca746695a7dea4e	gst_e2e_tenant_19035406820a497699286f211ca126f6	\N	GST Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	318.00	t	2026-10-31 13:40:27.581	2026-10-31 13:40:29.175
gst_e2e_customer_1009f79da0544b509415c0b38d81b5c6	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	\N	GST Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	318.00	t	2026-10-31 13:42:54.027	2026-10-31 13:42:55.993
gst_e2e_customer_caf9c8df9ec844819ddb9b8bd1fa5e5a	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	\N	Changed Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N		\N	\N	0.00	\N	318.00	t	2026-10-31 13:44:31.539	2026-10-31 13:44:34.178
q10-app-1793454341866-customer	q10-app-1793454341866-tenant	\N	Q10 Application Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	236.00	t	2026-10-31 13:45:41.869	2026-10-31 13:45:43.57
q10-app-1793460716221-customer	q10-app-1793460716221-tenant	\N	Q10 Application Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	0.00	t	2026-10-31 15:31:56.222	2026-10-31 15:31:56.222
q10-app-1793454409161-customer	q10-app-1793454409161-tenant	\N	Q10 Application Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	236.00	t	2026-10-31 13:46:49.162	2026-10-31 13:46:50.669
q10-app-1793454491946-customer	q10-app-1793454491946-tenant	\N	Q10 Application Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	236.00	t	2026-10-31 13:48:11.948	2026-10-31 13:48:13.211
\.


--
-- Data for Name: memberships; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.memberships (id, tenant_id, user_id, role_id, status, invited_by, invited_at, joined_at, created_at, updated_at) FROM stdin;
q10-q14-1793420207911-a-membership	q10-q14-1793420207911-a-tenant	q10-q14-1793420207911-a-user	q10-q14-1793420207911-a-role	active	\N	\N	\N	2026-10-31 04:16:47.969	2026-10-31 04:16:47.969
q10-q14-1793420207911-b-membership	q10-q14-1793420207911-b-tenant	q10-q14-1793420207911-b-user	q10-q14-1793420207911-b-role	active	\N	\N	\N	2026-10-31 04:16:48.008	2026-10-31 04:16:48.008
q10-q14-1793420214519-a-membership	q10-q14-1793420214519-a-tenant	q10-q14-1793420214519-a-user	q10-q14-1793420214519-a-role	active	\N	\N	\N	2026-10-31 04:16:54.574	2026-10-31 04:16:54.574
q10-q14-1793420214519-b-membership	q10-q14-1793420214519-b-tenant	q10-q14-1793420214519-b-user	q10-q14-1793420214519-b-role	active	\N	\N	\N	2026-10-31 04:16:54.615	2026-10-31 04:16:54.615
q10-q14-1793420220210-a-membership	q10-q14-1793420220210-a-tenant	q10-q14-1793420220210-a-user	q10-q14-1793420220210-a-role	active	\N	\N	\N	2026-10-31 04:17:00.268	2026-10-31 04:17:00.268
q10-q14-1793420220210-b-membership	q10-q14-1793420220210-b-tenant	q10-q14-1793420220210-b-user	q10-q14-1793420220210-b-role	active	\N	\N	\N	2026-10-31 04:17:00.306	2026-10-31 04:17:00.306
q10-q14-1793420220210-rollback-membership	q10-q14-1793420220210-rollback-tenant	q10-q14-1793420220210-rollback-user	q10-q14-1793420220210-rollback-role	active	\N	\N	\N	2026-10-31 04:17:00.393	2026-10-31 04:17:00.393
q10-q14-1793420220210-concurrent-membership	q10-q14-1793420220210-concurrent-tenant	q10-q14-1793420220210-concurrent-user	q10-q14-1793420220210-concurrent-role	active	\N	\N	\N	2026-10-31 04:17:00.434	2026-10-31 04:17:00.434
q10-q14-1793420348045-a-membership	q10-q14-1793420348045-a-tenant	q10-q14-1793420348045-a-user	q10-q14-1793420348045-a-role	active	\N	\N	\N	2026-10-31 04:19:08.093	2026-10-31 04:19:08.093
q10-q14-1793420348045-b-membership	q10-q14-1793420348045-b-tenant	q10-q14-1793420348045-b-user	q10-q14-1793420348045-b-role	active	\N	\N	\N	2026-10-31 04:19:08.125	2026-10-31 04:19:08.125
q10-q14-1793420355327-a-membership	q10-q14-1793420355327-a-tenant	q10-q14-1793420355327-a-user	q10-q14-1793420355327-a-role	active	\N	\N	\N	2026-10-31 04:19:15.377	2026-10-31 04:19:15.377
q10-q14-1793420355327-b-membership	q10-q14-1793420355327-b-tenant	q10-q14-1793420355327-b-user	q10-q14-1793420355327-b-role	active	\N	\N	\N	2026-10-31 04:19:15.409	2026-10-31 04:19:15.409
q10-q14-1793420355327-uncertain-membership	q10-q14-1793420355327-uncertain-tenant	q10-q14-1793420355327-uncertain-user	q10-q14-1793420355327-uncertain-role	active	\N	\N	\N	2026-10-31 04:19:15.469	2026-10-31 04:19:15.469
q10-q14-1793420355327-rollback-membership	q10-q14-1793420355327-rollback-tenant	q10-q14-1793420355327-rollback-user	q10-q14-1793420355327-rollback-role	active	\N	\N	\N	2026-10-31 04:19:15.508	2026-10-31 04:19:15.508
q10-q14-1793420355327-concurrent-membership	q10-q14-1793420355327-concurrent-tenant	q10-q14-1793420355327-concurrent-user	q10-q14-1793420355327-concurrent-role	active	\N	\N	\N	2026-10-31 04:19:15.538	2026-10-31 04:19:15.538
q10-q14-1793420355327-conflicting-membership	q10-q14-1793420355327-conflicting-tenant	q10-q14-1793420355327-conflicting-user	q10-q14-1793420355327-conflicting-role	active	\N	\N	\N	2026-10-31 04:19:15.573	2026-10-31 04:19:15.573
q10-q14-1793421051032-a-membership	q10-q14-1793421051032-a-tenant	q10-q14-1793421051032-a-user	q10-q14-1793421051032-a-role	active	\N	\N	\N	2026-10-31 04:30:51.126	2026-10-31 04:30:51.126
q10-q14-1793421051032-b-membership	q10-q14-1793421051032-b-tenant	q10-q14-1793421051032-b-user	q10-q14-1793421051032-b-role	active	\N	\N	\N	2026-10-31 04:30:51.203	2026-10-31 04:30:51.203
q10-q14-1793421051032-uncertain-membership	q10-q14-1793421051032-uncertain-tenant	q10-q14-1793421051032-uncertain-user	q10-q14-1793421051032-uncertain-role	active	\N	\N	\N	2026-10-31 04:30:51.365	2026-10-31 04:30:51.365
q10-q14-1793421051032-rollback-membership	q10-q14-1793421051032-rollback-tenant	q10-q14-1793421051032-rollback-user	q10-q14-1793421051032-rollback-role	active	\N	\N	\N	2026-10-31 04:30:51.468	2026-10-31 04:30:51.468
q10-q14-1793421051032-concurrent-membership	q10-q14-1793421051032-concurrent-tenant	q10-q14-1793421051032-concurrent-user	q10-q14-1793421051032-concurrent-role	active	\N	\N	\N	2026-10-31 04:30:51.534	2026-10-31 04:30:51.534
q10-q14-1793421051032-conflicting-membership	q10-q14-1793421051032-conflicting-tenant	q10-q14-1793421051032-conflicting-user	q10-q14-1793421051032-conflicting-role	active	\N	\N	\N	2026-10-31 04:30:51.605	2026-10-31 04:30:51.605
q10-q14-1793421102644-a-membership	q10-q14-1793421102644-a-tenant	q10-q14-1793421102644-a-user	q10-q14-1793421102644-a-role	active	\N	\N	\N	2026-10-31 04:31:42.721	2026-10-31 04:31:42.721
q10-q14-1793421102644-b-membership	q10-q14-1793421102644-b-tenant	q10-q14-1793421102644-b-user	q10-q14-1793421102644-b-role	active	\N	\N	\N	2026-10-31 04:31:42.753	2026-10-31 04:31:42.753
q10-q14-1793421102644-uncertain-membership	q10-q14-1793421102644-uncertain-tenant	q10-q14-1793421102644-uncertain-user	q10-q14-1793421102644-uncertain-role	active	\N	\N	\N	2026-10-31 04:31:42.822	2026-10-31 04:31:42.822
q10-q14-1793421102644-rollback-membership	q10-q14-1793421102644-rollback-tenant	q10-q14-1793421102644-rollback-user	q10-q14-1793421102644-rollback-role	active	\N	\N	\N	2026-10-31 04:31:42.862	2026-10-31 04:31:42.862
q10-q14-1793421102644-concurrent-membership	q10-q14-1793421102644-concurrent-tenant	q10-q14-1793421102644-concurrent-user	q10-q14-1793421102644-concurrent-role	active	\N	\N	\N	2026-10-31 04:31:42.892	2026-10-31 04:31:42.892
q10-q14-1793421102644-conflicting-membership	q10-q14-1793421102644-conflicting-tenant	q10-q14-1793421102644-conflicting-user	q10-q14-1793421102644-conflicting-role	active	\N	\N	\N	2026-10-31 04:31:42.928	2026-10-31 04:31:42.928
q10-q14-1793421202430-a-membership	q10-q14-1793421202430-a-tenant	q10-q14-1793421202430-a-user	q10-q14-1793421202430-a-role	active	\N	\N	\N	2026-10-31 04:33:22.534	2026-10-31 04:33:22.534
q10-q14-1793421202430-b-membership	q10-q14-1793421202430-b-tenant	q10-q14-1793421202430-b-user	q10-q14-1793421202430-b-role	active	\N	\N	\N	2026-10-31 04:33:22.583	2026-10-31 04:33:22.583
q10-q14-1793421202430-uncertain-membership	q10-q14-1793421202430-uncertain-tenant	q10-q14-1793421202430-uncertain-user	q10-q14-1793421202430-uncertain-role	active	\N	\N	\N	2026-10-31 04:33:22.696	2026-10-31 04:33:22.696
q10-q14-1793421202430-rollback-membership	q10-q14-1793421202430-rollback-tenant	q10-q14-1793421202430-rollback-user	q10-q14-1793421202430-rollback-role	active	\N	\N	\N	2026-10-31 04:33:22.771	2026-10-31 04:33:22.771
q10-q14-1793421202430-concurrent-membership	q10-q14-1793421202430-concurrent-tenant	q10-q14-1793421202430-concurrent-user	q10-q14-1793421202430-concurrent-role	active	\N	\N	\N	2026-10-31 04:33:22.819	2026-10-31 04:33:22.819
q10-q14-1793421202430-conflicting-membership	q10-q14-1793421202430-conflicting-tenant	q10-q14-1793421202430-conflicting-user	q10-q14-1793421202430-conflicting-role	active	\N	\N	\N	2026-10-31 04:33:22.877	2026-10-31 04:33:22.877
q10-q14-1793421457888-a-membership	q10-q14-1793421457888-a-tenant	q10-q14-1793421457888-a-user	q10-q14-1793421457888-a-role	active	\N	\N	\N	2026-10-31 04:37:37.984	2026-10-31 04:37:37.984
q10-q14-1793421457888-b-membership	q10-q14-1793421457888-b-tenant	q10-q14-1793421457888-b-user	q10-q14-1793421457888-b-role	active	\N	\N	\N	2026-10-31 04:37:38.019	2026-10-31 04:37:38.019
q10-q14-1793421457888-uncertain-membership	q10-q14-1793421457888-uncertain-tenant	q10-q14-1793421457888-uncertain-user	q10-q14-1793421457888-uncertain-role	active	\N	\N	\N	2026-10-31 04:37:38.092	2026-10-31 04:37:38.092
q10-q14-1793421457888-rollback-membership	q10-q14-1793421457888-rollback-tenant	q10-q14-1793421457888-rollback-user	q10-q14-1793421457888-rollback-role	active	\N	\N	\N	2026-10-31 04:37:38.14	2026-10-31 04:37:38.14
q10-q14-1793421457888-concurrent-membership	q10-q14-1793421457888-concurrent-tenant	q10-q14-1793421457888-concurrent-user	q10-q14-1793421457888-concurrent-role	active	\N	\N	\N	2026-10-31 04:37:38.176	2026-10-31 04:37:38.176
q10-q14-1793421457888-conflicting-membership	q10-q14-1793421457888-conflicting-tenant	q10-q14-1793421457888-conflicting-user	q10-q14-1793421457888-conflicting-role	active	\N	\N	\N	2026-10-31 04:37:38.215	2026-10-31 04:37:38.215
q10-q14-1793421934870-a-membership	q10-q14-1793421934870-a-tenant	q10-q14-1793421934870-a-user	q10-q14-1793421934870-a-role	active	\N	\N	\N	2026-10-31 04:45:34.921	2026-10-31 04:45:34.921
q10-q14-1793421934870-b-membership	q10-q14-1793421934870-b-tenant	q10-q14-1793421934870-b-user	q10-q14-1793421934870-b-role	active	\N	\N	\N	2026-10-31 04:45:34.942	2026-10-31 04:45:34.942
q10-q14-1793421934870-uncertain-membership	q10-q14-1793421934870-uncertain-tenant	q10-q14-1793421934870-uncertain-user	q10-q14-1793421934870-uncertain-role	active	\N	\N	\N	2026-10-31 04:45:34.984	2026-10-31 04:45:34.984
q10-q14-1793421934870-rollback-membership	q10-q14-1793421934870-rollback-tenant	q10-q14-1793421934870-rollback-user	q10-q14-1793421934870-rollback-role	active	\N	\N	\N	2026-10-31 04:45:35.008	2026-10-31 04:45:35.008
q10-q14-1793421934870-concurrent-membership	q10-q14-1793421934870-concurrent-tenant	q10-q14-1793421934870-concurrent-user	q10-q14-1793421934870-concurrent-role	active	\N	\N	\N	2026-10-31 04:45:35.026	2026-10-31 04:45:35.026
q10-q14-1793421934870-conflicting-membership	q10-q14-1793421934870-conflicting-tenant	q10-q14-1793421934870-conflicting-user	q10-q14-1793421934870-conflicting-role	active	\N	\N	\N	2026-10-31 04:45:35.047	2026-10-31 04:45:35.047
q14-1793428127358-membership-requester	q14-1793428127358-tenant-a	q14-1793428127358-requester	q14-1793428127358-role-a	active	\N	\N	\N	2026-10-31 06:28:47.403	2026-10-31 06:28:47.403
q14-1793428127358-membership-approver	q14-1793428127358-tenant-a	q14-1793428127358-approver	q14-1793428127358-role-a	active	\N	\N	\N	2026-10-31 06:28:47.403	2026-10-31 06:28:47.403
q14-1793428127358-membership-executor	q14-1793428127358-tenant-a	q14-1793428127358-executor	q14-1793428127358-role-a	active	\N	\N	\N	2026-10-31 06:28:47.403	2026-10-31 06:28:47.403
q14-1793428127358-membership-b	q14-1793428127358-tenant-b	q14-1793428127358-user-b	q14-1793428127358-role-b	active	\N	\N	\N	2026-10-31 06:28:47.403	2026-10-31 06:28:47.403
q14-1793428135758-membership-requester	q14-1793428135758-tenant-a	q14-1793428135758-requester	q14-1793428135758-role-a	active	\N	\N	\N	2026-10-31 06:28:55.812	2026-10-31 06:28:55.812
q14-1793428135758-membership-approver	q14-1793428135758-tenant-a	q14-1793428135758-approver	q14-1793428135758-role-a	active	\N	\N	\N	2026-10-31 06:28:55.812	2026-10-31 06:28:55.812
q14-1793428135758-membership-executor	q14-1793428135758-tenant-a	q14-1793428135758-executor	q14-1793428135758-role-a	active	\N	\N	\N	2026-10-31 06:28:55.812	2026-10-31 06:28:55.812
q14-1793428135758-membership-b	q14-1793428135758-tenant-b	q14-1793428135758-user-b	q14-1793428135758-role-b	active	\N	\N	\N	2026-10-31 06:28:55.812	2026-10-31 06:28:55.812
q14-1793428141699-membership-requester	q14-1793428141699-tenant-a	q14-1793428141699-requester	q14-1793428141699-role-a	active	\N	\N	\N	2026-10-31 06:29:01.752	2026-10-31 06:29:01.752
q14-1793428141699-membership-approver	q14-1793428141699-tenant-a	q14-1793428141699-approver	q14-1793428141699-role-a	active	\N	\N	\N	2026-10-31 06:29:01.752	2026-10-31 06:29:01.752
q14-1793428141699-membership-executor	q14-1793428141699-tenant-a	q14-1793428141699-executor	q14-1793428141699-role-a	active	\N	\N	\N	2026-10-31 06:29:01.752	2026-10-31 06:29:01.752
q14-1793428141699-membership-b	q14-1793428141699-tenant-b	q14-1793428141699-user-b	q14-1793428141699-role-b	active	\N	\N	\N	2026-10-31 06:29:01.752	2026-10-31 06:29:01.752
q14-1793428156995-membership-requester	q14-1793428156995-tenant-a	q14-1793428156995-requester	q14-1793428156995-role-a	active	\N	\N	\N	2026-10-31 06:29:17.052	2026-10-31 06:29:17.052
q14-1793428156995-membership-approver	q14-1793428156995-tenant-a	q14-1793428156995-approver	q14-1793428156995-role-a	active	\N	\N	\N	2026-10-31 06:29:17.052	2026-10-31 06:29:17.052
q14-1793428156995-membership-executor	q14-1793428156995-tenant-a	q14-1793428156995-executor	q14-1793428156995-role-a	active	\N	\N	\N	2026-10-31 06:29:17.052	2026-10-31 06:29:17.052
q14-1793428156995-membership-b	q14-1793428156995-tenant-b	q14-1793428156995-user-b	q14-1793428156995-role-b	active	\N	\N	\N	2026-10-31 06:29:17.052	2026-10-31 06:29:17.052
q14-1793428163409-membership-requester	q14-1793428163409-tenant-a	q14-1793428163409-requester	q14-1793428163409-role-a	active	\N	\N	\N	2026-10-31 06:29:23.466	2026-10-31 06:29:23.466
q14-1793428163409-membership-approver	q14-1793428163409-tenant-a	q14-1793428163409-approver	q14-1793428163409-role-a	active	\N	\N	\N	2026-10-31 06:29:23.466	2026-10-31 06:29:23.466
q14-1793428163409-membership-executor	q14-1793428163409-tenant-a	q14-1793428163409-executor	q14-1793428163409-role-a	active	\N	\N	\N	2026-10-31 06:29:23.466	2026-10-31 06:29:23.466
q14-1793428163409-membership-b	q14-1793428163409-tenant-b	q14-1793428163409-user-b	q14-1793428163409-role-b	active	\N	\N	\N	2026-10-31 06:29:23.466	2026-10-31 06:29:23.466
q14-1793428169511-membership-requester	q14-1793428169511-tenant-a	q14-1793428169511-requester	q14-1793428169511-role-a	active	\N	\N	\N	2026-10-31 06:29:29.568	2026-10-31 06:29:29.568
q14-1793428169511-membership-approver	q14-1793428169511-tenant-a	q14-1793428169511-approver	q14-1793428169511-role-a	active	\N	\N	\N	2026-10-31 06:29:29.568	2026-10-31 06:29:29.568
q14-1793428169511-membership-executor	q14-1793428169511-tenant-a	q14-1793428169511-executor	q14-1793428169511-role-a	active	\N	\N	\N	2026-10-31 06:29:29.568	2026-10-31 06:29:29.568
q14-1793428169511-membership-b	q14-1793428169511-tenant-b	q14-1793428169511-user-b	q14-1793428169511-role-b	active	\N	\N	\N	2026-10-31 06:29:29.568	2026-10-31 06:29:29.568
q10-q14-1793428172549-a-membership	q10-q14-1793428172549-a-tenant	q10-q14-1793428172549-a-user	q10-q14-1793428172549-a-role	active	\N	\N	\N	2026-10-31 06:29:32.66	2026-10-31 06:29:32.66
q10-q14-1793428172549-b-membership	q10-q14-1793428172549-b-tenant	q10-q14-1793428172549-b-user	q10-q14-1793428172549-b-role	active	\N	\N	\N	2026-10-31 06:29:32.707	2026-10-31 06:29:32.707
q10-q14-1793428172549-uncertain-membership	q10-q14-1793428172549-uncertain-tenant	q10-q14-1793428172549-uncertain-user	q10-q14-1793428172549-uncertain-role	active	\N	\N	\N	2026-10-31 06:29:32.813	2026-10-31 06:29:32.813
q10-q14-1793428172549-rollback-membership	q10-q14-1793428172549-rollback-tenant	q10-q14-1793428172549-rollback-user	q10-q14-1793428172549-rollback-role	active	\N	\N	\N	2026-10-31 06:29:32.882	2026-10-31 06:29:32.882
q10-q14-1793428172549-concurrent-membership	q10-q14-1793428172549-concurrent-tenant	q10-q14-1793428172549-concurrent-user	q10-q14-1793428172549-concurrent-role	active	\N	\N	\N	2026-10-31 06:29:32.931	2026-10-31 06:29:32.931
q10-q14-1793428172549-conflicting-membership	q10-q14-1793428172549-conflicting-tenant	q10-q14-1793428172549-conflicting-user	q10-q14-1793428172549-conflicting-role	active	\N	\N	\N	2026-10-31 06:29:32.989	2026-10-31 06:29:32.989
q14-1793428213621-membership-requester	q14-1793428213621-tenant-a	q14-1793428213621-requester	q14-1793428213621-role-a	active	\N	\N	\N	2026-10-31 06:30:13.672	2026-10-31 06:30:13.672
q14-1793428213621-membership-approver	q14-1793428213621-tenant-a	q14-1793428213621-approver	q14-1793428213621-role-a	active	\N	\N	\N	2026-10-31 06:30:13.672	2026-10-31 06:30:13.672
q14-1793428213621-membership-executor	q14-1793428213621-tenant-a	q14-1793428213621-executor	q14-1793428213621-role-a	active	\N	\N	\N	2026-10-31 06:30:13.672	2026-10-31 06:30:13.672
q14-1793428213621-membership-b	q14-1793428213621-tenant-b	q14-1793428213621-user-b	q14-1793428213621-role-b	active	\N	\N	\N	2026-10-31 06:30:13.672	2026-10-31 06:30:13.672
q10-q14-1793428213936-a-membership	q10-q14-1793428213936-a-tenant	q10-q14-1793428213936-a-user	q10-q14-1793428213936-a-role	active	\N	\N	\N	2026-10-31 06:30:14.025	2026-10-31 06:30:14.025
q10-q14-1793428213936-b-membership	q10-q14-1793428213936-b-tenant	q10-q14-1793428213936-b-user	q10-q14-1793428213936-b-role	active	\N	\N	\N	2026-10-31 06:30:14.06	2026-10-31 06:30:14.06
q10-q14-1793428213936-uncertain-membership	q10-q14-1793428213936-uncertain-tenant	q10-q14-1793428213936-uncertain-user	q10-q14-1793428213936-uncertain-role	active	\N	\N	\N	2026-10-31 06:30:14.142	2026-10-31 06:30:14.142
q10-q14-1793428213936-rollback-membership	q10-q14-1793428213936-rollback-tenant	q10-q14-1793428213936-rollback-user	q10-q14-1793428213936-rollback-role	active	\N	\N	\N	2026-10-31 06:30:14.193	2026-10-31 06:30:14.193
q10-q14-1793428213936-concurrent-membership	q10-q14-1793428213936-concurrent-tenant	q10-q14-1793428213936-concurrent-user	q10-q14-1793428213936-concurrent-role	active	\N	\N	\N	2026-10-31 06:30:14.226	2026-10-31 06:30:14.226
q10-q14-1793428213936-conflicting-membership	q10-q14-1793428213936-conflicting-tenant	q10-q14-1793428213936-conflicting-user	q10-q14-1793428213936-conflicting-role	active	\N	\N	\N	2026-10-31 06:30:14.264	2026-10-31 06:30:14.264
q10-app-1793446286377-membership	q10-app-1793446286377-tenant	q10-app-1793446286377-user	q10-app-1793446286377-role	active	\N	\N	\N	2026-10-31 11:31:26.379	2026-10-31 11:31:26.379
q10-app-1793446489184-membership	q10-app-1793446489184-tenant	q10-app-1793446489184-user	q10-app-1793446489184-role	active	\N	\N	\N	2026-10-31 11:34:49.185	2026-10-31 11:34:49.185
q10-app-1793446623070-membership	q10-app-1793446623070-tenant	q10-app-1793446623070-user	q10-app-1793446623070-role	active	\N	\N	\N	2026-10-31 11:37:03.072	2026-10-31 11:37:03.072
q14-1793446696706-membership-requester	q14-1793446696706-tenant-a	q14-1793446696706-requester	q14-1793446696706-role-a	active	\N	\N	\N	2026-10-31 11:38:16.816	2026-10-31 11:38:16.816
q14-1793446696706-membership-approver	q14-1793446696706-tenant-a	q14-1793446696706-approver	q14-1793446696706-role-a	active	\N	\N	\N	2026-10-31 11:38:16.816	2026-10-31 11:38:16.816
q14-1793446696706-membership-executor	q14-1793446696706-tenant-a	q14-1793446696706-executor	q14-1793446696706-role-a	active	\N	\N	\N	2026-10-31 11:38:16.816	2026-10-31 11:38:16.816
q14-1793446696706-membership-b	q14-1793446696706-tenant-b	q14-1793446696706-user-b	q14-1793446696706-role-b	active	\N	\N	\N	2026-10-31 11:38:16.816	2026-10-31 11:38:16.816
q10-q14-1793446761696-a-membership	q10-q14-1793446761696-a-tenant	q10-q14-1793446761696-a-user	q10-q14-1793446761696-a-role	active	\N	\N	\N	2026-10-31 11:39:21.775	2026-10-31 11:39:21.775
q10-q14-1793446761696-b-membership	q10-q14-1793446761696-b-tenant	q10-q14-1793446761696-b-user	q10-q14-1793446761696-b-role	active	\N	\N	\N	2026-10-31 11:39:21.805	2026-10-31 11:39:21.805
q10-q14-1793446761696-uncertain-membership	q10-q14-1793446761696-uncertain-tenant	q10-q14-1793446761696-uncertain-user	q10-q14-1793446761696-uncertain-role	active	\N	\N	\N	2026-10-31 11:39:21.875	2026-10-31 11:39:21.875
q10-q14-1793446761696-rollback-membership	q10-q14-1793446761696-rollback-tenant	q10-q14-1793446761696-rollback-user	q10-q14-1793446761696-rollback-role	active	\N	\N	\N	2026-10-31 11:39:21.92	2026-10-31 11:39:21.92
q10-q14-1793446761696-concurrent-membership	q10-q14-1793446761696-concurrent-tenant	q10-q14-1793446761696-concurrent-user	q10-q14-1793446761696-concurrent-role	active	\N	\N	\N	2026-10-31 11:39:21.948	2026-10-31 11:39:21.948
q10-q14-1793446761696-conflicting-membership	q10-q14-1793446761696-conflicting-tenant	q10-q14-1793446761696-conflicting-user	q10-q14-1793446761696-conflicting-role	active	\N	\N	\N	2026-10-31 11:39:21.986	2026-10-31 11:39:21.986
q10-app-1793447402381-membership	q10-app-1793447402381-tenant	q10-app-1793447402381-user	q10-app-1793447402381-role	active	\N	\N	\N	2026-10-31 11:50:02.383	2026-10-31 11:50:02.383
q10-app-1793447603960-membership	q10-app-1793447603960-tenant	q10-app-1793447603960-user	q10-app-1793447603960-role	active	\N	\N	\N	2026-10-31 11:53:23.961	2026-10-31 11:53:23.961
q10-q14-1793447682627-a-membership	q10-q14-1793447682627-a-tenant	q10-q14-1793447682627-a-user	q10-q14-1793447682627-a-role	active	\N	\N	\N	2026-10-31 11:54:42.698	2026-10-31 11:54:42.698
q10-q14-1793447682627-b-membership	q10-q14-1793447682627-b-tenant	q10-q14-1793447682627-b-user	q10-q14-1793447682627-b-role	active	\N	\N	\N	2026-10-31 11:54:42.739	2026-10-31 11:54:42.739
q10-q14-1793447682627-uncertain-membership	q10-q14-1793447682627-uncertain-tenant	q10-q14-1793447682627-uncertain-user	q10-q14-1793447682627-uncertain-role	active	\N	\N	\N	2026-10-31 11:54:42.819	2026-10-31 11:54:42.819
q10-q14-1793447682627-rollback-membership	q10-q14-1793447682627-rollback-tenant	q10-q14-1793447682627-rollback-user	q10-q14-1793447682627-rollback-role	active	\N	\N	\N	2026-10-31 11:54:42.863	2026-10-31 11:54:42.863
q10-q14-1793447682627-concurrent-membership	q10-q14-1793447682627-concurrent-tenant	q10-q14-1793447682627-concurrent-user	q10-q14-1793447682627-concurrent-role	active	\N	\N	\N	2026-10-31 11:54:42.897	2026-10-31 11:54:42.897
q10-q14-1793447682627-conflicting-membership	q10-q14-1793447682627-conflicting-tenant	q10-q14-1793447682627-conflicting-user	q10-q14-1793447682627-conflicting-role	active	\N	\N	\N	2026-10-31 11:54:42.93	2026-10-31 11:54:42.93
q14-1793447733823-membership-requester	q14-1793447733823-tenant-a	q14-1793447733823-requester	q14-1793447733823-role-a	active	\N	\N	\N	2026-10-31 11:55:33.971	2026-10-31 11:55:33.971
q14-1793447733823-membership-approver	q14-1793447733823-tenant-a	q14-1793447733823-approver	q14-1793447733823-role-a	active	\N	\N	\N	2026-10-31 11:55:33.971	2026-10-31 11:55:33.971
q14-1793447733823-membership-executor	q14-1793447733823-tenant-a	q14-1793447733823-executor	q14-1793447733823-role-a	active	\N	\N	\N	2026-10-31 11:55:33.971	2026-10-31 11:55:33.971
q14-1793447733823-membership-b	q14-1793447733823-tenant-b	q14-1793447733823-user-b	q14-1793447733823-role-b	active	\N	\N	\N	2026-10-31 11:55:33.971	2026-10-31 11:55:33.971
q10-app-1793452881250-membership	q10-app-1793452881250-tenant	q10-app-1793452881250-user	q10-app-1793452881250-role	active	\N	\N	\N	2026-10-31 13:21:21.252	2026-10-31 13:21:21.252
q14-1793452880879-membership-requester	q14-1793452880879-tenant-a	q14-1793452880879-requester	q14-1793452880879-role-a	active	\N	\N	\N	2026-10-31 13:21:21.314	2026-10-31 13:21:21.314
q14-1793452880879-membership-approver	q14-1793452880879-tenant-a	q14-1793452880879-approver	q14-1793452880879-role-a	active	\N	\N	\N	2026-10-31 13:21:21.314	2026-10-31 13:21:21.314
q14-1793452880879-membership-executor	q14-1793452880879-tenant-a	q14-1793452880879-executor	q14-1793452880879-role-a	active	\N	\N	\N	2026-10-31 13:21:21.314	2026-10-31 13:21:21.314
q14-1793452880879-membership-b	q14-1793452880879-tenant-b	q14-1793452880879-user-b	q14-1793452880879-role-b	active	\N	\N	\N	2026-10-31 13:21:21.314	2026-10-31 13:21:21.314
q10-app-1793453149906-membership	q10-app-1793453149906-tenant	q10-app-1793453149906-user	q10-app-1793453149906-role	active	\N	\N	\N	2026-10-31 13:25:49.908	2026-10-31 13:25:49.908
gst_e2e_membership_157ab353bc034261878493cdd101dba3	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	gst_e2e_user_3150505d81e0469bbfb628cffe5c9bf9	gst_e2e_role_67b17b0e9374463c9452711d4a5a47e6	active	\N	\N	\N	2026-10-31 13:29:28.512	2026-10-31 13:29:28.512
gst_e2e_membership_cddf1b53e7a84908becdf020da632566	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_user_201a2af19f5249ceb962445e5af84b88	gst_e2e_role_2e56d5ab9daf4442aff1b69056e58da1	active	\N	\N	\N	2026-10-31 13:29:43.689	2026-10-31 13:29:43.689
gst_e2e_membership_a30d0390f1da442d88966edb68bb68fd	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_user_32a2363357184cc998bf64097e49da97	gst_e2e_role_3fd234d307304fcfbc70437ecb6eb72a	active	\N	\N	\N	2026-10-31 13:29:58.518	2026-10-31 13:29:58.518
gst_e2e_membership_dccfb3488bb9441893e2e576cc6fe8b2	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_user_742f142a1b0a497e9cec9800129dbac2	gst_e2e_role_442b2f5f0f834ff6b2e30d9d966cd6f4	active	\N	\N	\N	2026-10-31 13:30:12.558	2026-10-31 13:30:12.558
gst_e2e_membership_1a2cf1d65db342089313b83dd482d91d	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_user_6cba5ebe1d0948bc92358a43ccbde31d	gst_e2e_role_4a865af21fcc4325a869b349769edffe	active	\N	\N	\N	2026-10-31 13:31:24.678	2026-10-31 13:31:24.678
gst_e2e_membership_06a1cb1c6801491eb3e16edde3535f10	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_user_1e3d6dc3e3af44828ea74a666498c4b3	gst_e2e_role_1036ef3bfaa34b5980def96ce15e1c00	active	\N	\N	\N	2026-10-31 13:32:42.82	2026-10-31 13:32:42.82
gst_e2e_membership_c8d52f2d9d93451a8259ab0879be66cb	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_user_c9bcf582e8ec42a29706c6758a4c5227	gst_e2e_role_20ecd850b7ee427688c96eb1bf448799	active	\N	\N	\N	2026-10-31 13:33:55.958	2026-10-31 13:33:55.958
gst_e2e_membership_21bfedf0ae6947e4829b40618e2cb7ec	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_user_6c87a7d4a4cf4788828673be1bf2844b	gst_e2e_role_b614efd80c45477ab2a8c36d625bf301	active	\N	\N	\N	2026-10-31 13:35:09.31	2026-10-31 13:35:09.31
gst_e2e_membership_4c82e0f9df22462fa68e3b900d05de5c	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_user_f0e91ddf6de143cca30b52d49086168a	gst_e2e_role_8994a4096ae445e79ada464f95ea0480	active	\N	\N	\N	2026-10-31 13:36:28.408	2026-10-31 13:36:28.408
gst_e2e_membership_1fda0d27d95245bb8d215a787bd6ca7a	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_user_eed392649bbe46f59b199bee1f03c7e6	gst_e2e_role_b66e5f7285314af6a1fdf7241267fa1c	active	\N	\N	\N	2026-10-31 13:37:50.384	2026-10-31 13:37:50.384
gst_e2e_membership_ccb7741181d042c3a7a11a78a50626b2	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_user_543643bc2f9f43bd8fe5cbdaff72cbef	gst_e2e_role_83bdd68b81794d8c9535c7845217e61e	active	\N	\N	\N	2026-10-31 13:39:14.029	2026-10-31 13:39:14.029
gst_e2e_membership_5c263d013fa34469870be8eca0547662	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_user_3df03d91d95a4aa193cd6d6b5b63d29f	gst_e2e_role_c1e4d2d6616a4cbcb7490da77252c5e0	active	\N	\N	\N	2026-10-31 13:40:27.581	2026-10-31 13:40:27.581
gst_e2e_membership_8c515a3dd23b43a29c97318b841800e1	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_user_24a2027af5904578b7fcdaab60fcb210	gst_e2e_role_20db3826e5b143b2b5dce898eb489cc2	active	\N	\N	\N	2026-10-31 13:41:41.091	2026-10-31 13:41:41.091
gst_e2e_membership_9c168e23022c4ea6a91e30bf7f53d51f	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_user_62a1702e07e74656821fa5094b20b72d	gst_e2e_role_28890c5872d647dd9cb9d1bfd4c44da4	active	\N	\N	\N	2026-10-31 13:42:54.027	2026-10-31 13:42:54.027
gst_e2e_membership_a738e1c7be164a439440d2b9df289c9c	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_user_b50dbb92d78b45a9947a6a5e5df0cad0	gst_e2e_role_a45f98bab75e4d3d9b482e362c20a6b1	active	\N	\N	\N	2026-10-31 13:44:31.539	2026-10-31 13:44:31.539
q10-app-1793454341866-membership	q10-app-1793454341866-tenant	q10-app-1793454341866-user	q10-app-1793454341866-role	active	\N	\N	\N	2026-10-31 13:45:41.869	2026-10-31 13:45:41.869
q10-app-1793454409161-membership	q10-app-1793454409161-tenant	q10-app-1793454409161-user	q10-app-1793454409161-role	active	\N	\N	\N	2026-10-31 13:46:49.162	2026-10-31 13:46:49.162
q10-app-1793454491946-membership	q10-app-1793454491946-tenant	q10-app-1793454491946-user	q10-app-1793454491946-role	active	\N	\N	\N	2026-10-31 13:48:11.948	2026-10-31 13:48:11.948
q10-app-1793460716221-membership	q10-app-1793460716221-tenant	q10-app-1793460716221-user	q10-app-1793460716221-role	active	\N	\N	\N	2026-10-31 15:31:56.222	2026-10-31 15:31:56.222
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payments (id, tenant_id, customer_id, invoice_id, entry_type, payment_mode, amount, reference_no, payment_date, notes, created_by, created_at) FROM stdin;
cmvwg6gpi000zkez5faioa8vq	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_customer_8ddd37d3f7b44572b56a8478c4adec59	\N	PAYMENT_RECEIVED	CASH	50.00	GST-gst_e2e_sales_success_9e5c4bd6a06442659dae4570dd904250	2026-10-31 13:39:15.6	\N	gst_e2e_user_543643bc2f9f43bd8fe5cbdaff72cbef	2026-10-31 13:39:15.605
cmvwg81gu000zemki0tiaydtd	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_customer_f56e9da2dcea4246bca746695a7dea4e	\N	PAYMENT_RECEIVED	CASH	50.00	GST-gst_e2e_sales_success_861a943099ab401896b2cf2663424588	2026-10-31 13:40:29.158	\N	gst_e2e_user_3df03d91d95a4aa193cd6d6b5b63d29f	2026-10-31 13:40:29.165
cmvwg9mh5000zdaacn6lxqkbi	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_customer_9cc2dac0526449ffbd1ddcf488281125	\N	PAYMENT_RECEIVED	CASH	50.00	GST-gst_e2e_sales_success_ad360a6411064d099a18d08fa4bf62c4	2026-10-31 13:41:43.043	\N	gst_e2e_user_24a2027af5904578b7fcdaab60fcb210	2026-10-31 13:41:43.048
cmvwg9mj50015daac0a546v14	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	\N	\N	PAYMENT_MADE	CREDIT	40.00	GST-SUP-gst_e2e_purchase_success_aaefa95e91204a878b000841573921e3	2026-10-31 13:41:43.115	\N	gst_e2e_user_24a2027af5904578b7fcdaab60fcb210	2026-10-31 13:41:43.12
cmvwgb6r3000zvg91yj1vbd5x	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_customer_1009f79da0544b509415c0b38d81b5c6	\N	PAYMENT_RECEIVED	CASH	50.00	GST-gst_e2e_sales_success_b3d1b8d7803746e8a34a24ada270c41d	2026-10-31 13:42:55.974	\N	gst_e2e_user_62a1702e07e74656821fa5094b20b72d	2026-10-31 13:42:55.982
cmvwgb6tk0015vg9165bb4tg5	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	\N	\N	PAYMENT_MADE	CREDIT	40.00	GST-SUP-gst_e2e_purchase_success_b47ae86c87784e399a738d3dc2c10eac	2026-10-31 13:42:56.063	\N	gst_e2e_user_62a1702e07e74656821fa5094b20b72d	2026-10-31 13:42:56.071
cmvwgda2t000zetes99boqgz5	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_customer_caf9c8df9ec844819ddb9b8bd1fa5e5a	\N	PAYMENT_RECEIVED	CASH	50.00	GST-gst_e2e_sales_success_e95ec457a9c74f97be29242a8011148c	2026-10-31 13:44:33.592	\N	gst_e2e_user_b50dbb92d78b45a9947a6a5e5df0cad0	2026-10-31 13:44:33.603
cmvwgda5m0015etesoq10v43h	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	\N	\N	PAYMENT_MADE	CREDIT	40.00	GST-SUP-gst_e2e_purchase_success_f1dc1040426446d1986b7570aedcf581	2026-10-31 13:44:33.697	\N	gst_e2e_user_b50dbb92d78b45a9947a6a5e5df0cad0	2026-10-31 13:44:33.705
\.


--
-- Data for Name: product_batches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_batches (id, tenant_id, product_id, batch_no, expiry_date, mrp, purchase_rate, sale_rate, received_qty, available_qty, supplier_id, purchase_id, is_blocked, created_at, updated_at) FROM stdin;
q10-q14-1793420207911-a-batch	q10-q14-1793420207911-a-tenant	q10-q14-1793420207911-a-product	q10-q14-1793420207911-a-batch	2027-10-31 04:16:47.969	\N	\N	100.00	10	10	\N	\N	f	2026-10-31 04:16:47.969	2026-10-31 04:16:47.969
q10-q14-1793420207911-b-batch	q10-q14-1793420207911-b-tenant	q10-q14-1793420207911-b-product	q10-q14-1793420207911-b-batch	2027-10-31 04:16:48.008	\N	\N	100.00	10	10	\N	\N	f	2026-10-31 04:16:48.008	2026-10-31 04:16:48.008
q10-q14-1793420214519-a-batch	q10-q14-1793420214519-a-tenant	q10-q14-1793420214519-a-product	q10-q14-1793420214519-a-batch	2027-10-31 04:16:54.574	\N	\N	100.00	10	10	\N	\N	f	2026-10-31 04:16:54.574	2026-10-31 04:16:54.574
q10-q14-1793420214519-b-batch	q10-q14-1793420214519-b-tenant	q10-q14-1793420214519-b-product	q10-q14-1793420214519-b-batch	2027-10-31 04:16:54.615	\N	\N	100.00	10	10	\N	\N	f	2026-10-31 04:16:54.615	2026-10-31 04:16:54.615
q10-q14-1793420220210-b-batch	q10-q14-1793420220210-b-tenant	q10-q14-1793420220210-b-product	q10-q14-1793420220210-b-batch	2027-10-31 04:17:00.306	\N	\N	100.00	10	10	\N	\N	f	2026-10-31 04:17:00.306	2026-10-31 04:17:00.306
q10-q14-1793420220210-a-batch	q10-q14-1793420220210-a-tenant	q10-q14-1793420220210-a-product	q10-q14-1793420220210-a-batch	2027-10-31 04:17:00.268	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:17:00.268	2026-10-31 04:17:00.344
q10-q14-1793420220210-rollback-batch	q10-q14-1793420220210-rollback-tenant	q10-q14-1793420220210-rollback-product	q10-q14-1793420220210-rollback-batch	2027-10-31 04:17:00.393	\N	\N	100.00	10	10	\N	\N	f	2026-10-31 04:17:00.393	2026-10-31 04:17:00.393
q10-q14-1793420220210-concurrent-batch	q10-q14-1793420220210-concurrent-tenant	q10-q14-1793420220210-concurrent-product	q10-q14-1793420220210-concurrent-batch	2027-10-31 04:17:00.434	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:17:00.434	2026-10-31 04:17:00.46
q10-q14-1793420348045-a-batch	q10-q14-1793420348045-a-tenant	q10-q14-1793420348045-a-product	q10-q14-1793420348045-a-batch	2027-10-31 04:19:08.093	\N	\N	100.00	10	10	\N	\N	f	2026-10-31 04:19:08.093	2026-10-31 04:19:08.093
q10-q14-1793420348045-b-batch	q10-q14-1793420348045-b-tenant	q10-q14-1793420348045-b-product	q10-q14-1793420348045-b-batch	2027-10-31 04:19:08.125	\N	\N	100.00	10	10	\N	\N	f	2026-10-31 04:19:08.125	2026-10-31 04:19:08.125
q10-q14-1793420355327-b-batch	q10-q14-1793420355327-b-tenant	q10-q14-1793420355327-b-product	q10-q14-1793420355327-b-batch	2027-10-31 04:19:15.409	\N	\N	100.00	10	10	\N	\N	f	2026-10-31 04:19:15.409	2026-10-31 04:19:15.409
q10-q14-1793420355327-a-batch	q10-q14-1793420355327-a-tenant	q10-q14-1793420355327-a-product	q10-q14-1793420355327-a-batch	2027-10-31 04:19:15.377	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:19:15.377	2026-10-31 04:19:15.443
q10-q14-1793420355327-uncertain-batch	q10-q14-1793420355327-uncertain-tenant	q10-q14-1793420355327-uncertain-product	q10-q14-1793420355327-uncertain-batch	2027-10-31 04:19:15.469	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:19:15.469	2026-10-31 04:19:15.485
q10-q14-1793420355327-rollback-batch	q10-q14-1793420355327-rollback-tenant	q10-q14-1793420355327-rollback-product	q10-q14-1793420355327-rollback-batch	2027-10-31 04:19:15.508	\N	\N	100.00	10	10	\N	\N	f	2026-10-31 04:19:15.508	2026-10-31 04:19:15.508
q10-q14-1793420355327-concurrent-batch	q10-q14-1793420355327-concurrent-tenant	q10-q14-1793420355327-concurrent-product	q10-q14-1793420355327-concurrent-batch	2027-10-31 04:19:15.538	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:19:15.538	2026-10-31 04:19:15.557
q10-q14-1793420355327-conflicting-batch	q10-q14-1793420355327-conflicting-tenant	q10-q14-1793420355327-conflicting-product	q10-q14-1793420355327-conflicting-batch	2027-10-31 04:19:15.573	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:19:15.573	2026-10-31 04:19:15.591
q10-q14-1793421051032-a-batch	q10-q14-1793421051032-a-tenant	q10-q14-1793421051032-a-product	q10-q14-1793421051032-a-batch	2027-10-31 04:30:51.126	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:30:51.126	2026-10-31 04:30:51.303
q10-q14-1793421051032-uncertain-batch	q10-q14-1793421051032-uncertain-tenant	q10-q14-1793421051032-uncertain-product	q10-q14-1793421051032-uncertain-batch	2027-10-31 04:30:51.365	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:30:51.365	2026-10-31 04:30:51.411
q10-q14-1793421051032-concurrent-batch	q10-q14-1793421051032-concurrent-tenant	q10-q14-1793421051032-concurrent-product	q10-q14-1793421051032-concurrent-batch	2027-10-31 04:30:51.534	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:30:51.534	2026-10-31 04:30:51.574
q10-q14-1793421051032-conflicting-batch	q10-q14-1793421051032-conflicting-tenant	q10-q14-1793421051032-conflicting-product	q10-q14-1793421051032-conflicting-batch	2027-10-31 04:30:51.605	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:30:51.605	2026-10-31 04:30:51.639
q10-q14-1793421102644-a-batch	q10-q14-1793421102644-a-tenant	q10-q14-1793421102644-a-product	q10-q14-1793421102644-a-batch	2027-10-31 04:31:42.721	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:31:42.721	2026-10-31 04:31:42.794
q10-q14-1793421102644-uncertain-batch	q10-q14-1793421102644-uncertain-tenant	q10-q14-1793421102644-uncertain-product	q10-q14-1793421102644-uncertain-batch	2027-10-31 04:31:42.822	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:31:42.822	2026-10-31 04:31:42.839
q10-q14-1793421102644-concurrent-batch	q10-q14-1793421102644-concurrent-tenant	q10-q14-1793421102644-concurrent-product	q10-q14-1793421102644-concurrent-batch	2027-10-31 04:31:42.892	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:31:42.892	2026-10-31 04:31:42.912
q10-q14-1793421102644-conflicting-batch	q10-q14-1793421102644-conflicting-tenant	q10-q14-1793421102644-conflicting-product	q10-q14-1793421102644-conflicting-batch	2027-10-31 04:31:42.928	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:31:42.928	2026-10-31 04:31:42.946
q10-q14-1793421202430-a-batch	q10-q14-1793421202430-a-tenant	q10-q14-1793421202430-a-product	q10-q14-1793421202430-a-batch	2027-10-31 04:33:22.534	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:33:22.534	2026-10-31 04:33:22.648
q10-q14-1793421202430-uncertain-batch	q10-q14-1793421202430-uncertain-tenant	q10-q14-1793421202430-uncertain-product	q10-q14-1793421202430-uncertain-batch	2027-10-31 04:33:22.696	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:33:22.696	2026-10-31 04:33:22.728
q10-q14-1793421202430-concurrent-batch	q10-q14-1793421202430-concurrent-tenant	q10-q14-1793421202430-concurrent-product	q10-q14-1793421202430-concurrent-batch	2027-10-31 04:33:22.819	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:33:22.819	2026-10-31 04:33:22.85
q10-q14-1793421202430-conflicting-batch	q10-q14-1793421202430-conflicting-tenant	q10-q14-1793421202430-conflicting-product	q10-q14-1793421202430-conflicting-batch	2027-10-31 04:33:22.877	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:33:22.877	2026-10-31 04:33:22.906
q10-q14-1793421202430-rollback-batch	q10-q14-1793421202430-rollback-tenant	q10-q14-1793421202430-rollback-product	q10-q14-1793421202430-rollback-batch	2027-10-31 04:33:22.771	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:33:22.771	2026-10-31 04:36:31.792
q10-q14-1793421202430-b-batch	q10-q14-1793421202430-b-tenant	q10-q14-1793421202430-b-product	q10-q14-1793421202430-b-batch	2027-10-31 04:33:22.583	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:33:22.583	2026-10-31 04:40:03.489
q10-q14-1793421102644-rollback-batch	q10-q14-1793421102644-rollback-tenant	q10-q14-1793421102644-rollback-product	q10-q14-1793421102644-rollback-batch	2027-10-31 04:31:42.862	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:31:42.862	2026-10-31 04:42:16.124
q10-q14-1793421102644-b-batch	q10-q14-1793421102644-b-tenant	q10-q14-1793421102644-b-product	q10-q14-1793421102644-b-batch	2027-10-31 04:31:42.753	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:31:42.753	2026-10-31 04:42:16.213
q10-q14-1793421051032-rollback-batch	q10-q14-1793421051032-rollback-tenant	q10-q14-1793421051032-rollback-product	q10-q14-1793421051032-rollback-batch	2027-10-31 04:30:51.468	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:30:51.468	2026-10-31 04:44:28.01
q10-q14-1793421051032-b-batch	q10-q14-1793421051032-b-tenant	q10-q14-1793421051032-b-product	q10-q14-1793421051032-b-batch	2027-10-31 04:30:51.203	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:30:51.203	2026-10-31 04:44:28.085
q10-app-1793446286377-batch	q10-app-1793446286377-tenant	q10-app-1793446286377-product	q10-app-1793446286377-batch	2027-10-31 11:31:26.379	\N	\N	100.00	100	98	\N	\N	f	2026-10-31 11:31:26.379	2026-10-31 11:31:27.257
q10-q14-1793421457888-a-batch	q10-q14-1793421457888-a-tenant	q10-q14-1793421457888-a-product	q10-q14-1793421457888-a-batch	2027-10-31 04:37:37.984	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:37:37.984	2026-10-31 04:37:38.059
q10-q14-1793421457888-uncertain-batch	q10-q14-1793421457888-uncertain-tenant	q10-q14-1793421457888-uncertain-product	q10-q14-1793421457888-uncertain-batch	2027-10-31 04:37:38.092	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:37:38.092	2026-10-31 04:37:38.114
q10-app-1793446489184-batch	q10-app-1793446489184-tenant	q10-app-1793446489184-product	q10-app-1793446489184-batch	2027-10-31 11:34:49.185	\N	\N	100.00	100	98	\N	\N	f	2026-10-31 11:34:49.185	2026-10-31 11:34:50.055
q10-app-1793446623070-batch	q10-app-1793446623070-tenant	q10-app-1793446623070-product	q10-app-1793446623070-batch	2027-10-31 11:37:03.072	\N	\N	100.00	100	98	\N	\N	f	2026-10-31 11:37:03.072	2026-10-31 11:37:04.149
q10-q14-1793421457888-concurrent-batch	q10-q14-1793421457888-concurrent-tenant	q10-q14-1793421457888-concurrent-product	q10-q14-1793421457888-concurrent-batch	2027-10-31 04:37:38.176	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:37:38.176	2026-10-31 04:37:38.198
q10-q14-1793446761696-b-batch	q10-q14-1793446761696-b-tenant	q10-q14-1793446761696-b-product	q10-q14-1793446761696-b-batch	2027-10-31 11:39:21.805	\N	\N	100.00	10	10	\N	\N	f	2026-10-31 11:39:21.805	2026-10-31 11:39:21.805
q10-q14-1793421457888-conflicting-batch	q10-q14-1793421457888-conflicting-tenant	q10-q14-1793421457888-conflicting-product	q10-q14-1793421457888-conflicting-batch	2027-10-31 04:37:38.215	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:37:38.215	2026-10-31 04:37:38.233
q10-q14-1793421457888-b-batch	q10-q14-1793421457888-b-tenant	q10-q14-1793421457888-b-product	q10-q14-1793421457888-b-batch	2027-10-31 04:37:38.019	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:37:38.019	2026-10-31 04:37:38.567
q10-q14-1793421457888-rollback-batch	q10-q14-1793421457888-rollback-tenant	q10-q14-1793421457888-rollback-product	q10-q14-1793421457888-rollback-batch	2027-10-31 04:37:38.14	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:37:38.14	2026-10-31 04:38:53.015
q10-q14-1793446761696-a-batch	q10-q14-1793446761696-a-tenant	q10-q14-1793446761696-a-product	q10-q14-1793446761696-a-batch	2027-10-31 11:39:21.775	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 11:39:21.775	2026-10-31 11:39:21.851
q10-q14-1793421934870-a-batch	q10-q14-1793421934870-a-tenant	q10-q14-1793421934870-a-product	q10-q14-1793421934870-a-batch	2027-10-31 04:45:34.921	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:45:34.921	2026-10-31 04:45:34.968
q10-q14-1793446761696-uncertain-batch	q10-q14-1793446761696-uncertain-tenant	q10-q14-1793446761696-uncertain-product	q10-q14-1793446761696-uncertain-batch	2027-10-31 11:39:21.875	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 11:39:21.875	2026-10-31 11:39:21.891
q10-q14-1793421934870-uncertain-batch	q10-q14-1793421934870-uncertain-tenant	q10-q14-1793421934870-uncertain-product	q10-q14-1793421934870-uncertain-batch	2027-10-31 04:45:34.984	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:45:34.984	2026-10-31 04:45:34.994
q10-q14-1793446761696-rollback-batch	q10-q14-1793446761696-rollback-tenant	q10-q14-1793446761696-rollback-product	q10-q14-1793446761696-rollback-batch	2027-10-31 11:39:21.92	\N	\N	100.00	10	10	\N	\N	f	2026-10-31 11:39:21.92	2026-10-31 11:39:21.92
q10-q14-1793421934870-concurrent-batch	q10-q14-1793421934870-concurrent-tenant	q10-q14-1793421934870-concurrent-product	q10-q14-1793421934870-concurrent-batch	2027-10-31 04:45:35.026	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:45:35.026	2026-10-31 04:45:35.038
q10-q14-1793446761696-concurrent-batch	q10-q14-1793446761696-concurrent-tenant	q10-q14-1793446761696-concurrent-product	q10-q14-1793446761696-concurrent-batch	2027-10-31 11:39:21.948	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 11:39:21.948	2026-10-31 11:39:21.967
q10-q14-1793421934870-conflicting-batch	q10-q14-1793421934870-conflicting-tenant	q10-q14-1793421934870-conflicting-product	q10-q14-1793421934870-conflicting-batch	2027-10-31 04:45:35.047	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:45:35.047	2026-10-31 04:45:35.058
q10-q14-1793421934870-rollback-batch	q10-q14-1793421934870-rollback-tenant	q10-q14-1793421934870-rollback-product	q10-q14-1793421934870-rollback-batch	2027-10-31 04:45:35.008	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:45:35.008	2026-10-31 04:45:35.707
q10-q14-1793421934870-b-batch	q10-q14-1793421934870-b-tenant	q10-q14-1793421934870-b-product	q10-q14-1793421934870-b-batch	2027-10-31 04:45:34.942	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 04:45:34.942	2026-10-31 04:45:35.754
q10-q14-1793446761696-conflicting-batch	q10-q14-1793446761696-conflicting-tenant	q10-q14-1793446761696-conflicting-product	q10-q14-1793446761696-conflicting-batch	2027-10-31 11:39:21.986	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 11:39:21.986	2026-10-31 11:39:22.009
q10-q14-1793428172549-a-batch	q10-q14-1793428172549-a-tenant	q10-q14-1793428172549-a-product	q10-q14-1793428172549-a-batch	2027-10-31 06:29:32.66	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 06:29:32.66	2026-10-31 06:29:32.77
q10-app-1793447402381-batch	q10-app-1793447402381-tenant	q10-app-1793447402381-product	q10-app-1793447402381-batch	2027-10-31 11:50:02.383	\N	\N	100.00	100	100	\N	\N	f	2026-10-31 11:50:02.383	2026-10-31 11:50:02.383
q10-q14-1793428172549-uncertain-batch	q10-q14-1793428172549-uncertain-tenant	q10-q14-1793428172549-uncertain-product	q10-q14-1793428172549-uncertain-batch	2027-10-31 06:29:32.813	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 06:29:32.813	2026-10-31 06:29:32.842
q10-q14-1793428172549-concurrent-batch	q10-q14-1793428172549-concurrent-tenant	q10-q14-1793428172549-concurrent-product	q10-q14-1793428172549-concurrent-batch	2027-10-31 06:29:32.931	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 06:29:32.931	2026-10-31 06:29:32.962
q10-q14-1793428172549-conflicting-batch	q10-q14-1793428172549-conflicting-tenant	q10-q14-1793428172549-conflicting-product	q10-q14-1793428172549-conflicting-batch	2027-10-31 06:29:32.989	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 06:29:32.989	2026-10-31 06:29:33.014
q10-q14-1793428213936-a-batch	q10-q14-1793428213936-a-tenant	q10-q14-1793428213936-a-product	q10-q14-1793428213936-a-batch	2027-10-31 06:30:14.025	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 06:30:14.025	2026-10-31 06:30:14.11
q10-q14-1793428213936-uncertain-batch	q10-q14-1793428213936-uncertain-tenant	q10-q14-1793428213936-uncertain-product	q10-q14-1793428213936-uncertain-batch	2027-10-31 06:30:14.142	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 06:30:14.142	2026-10-31 06:30:14.16
q10-q14-1793428213936-concurrent-batch	q10-q14-1793428213936-concurrent-tenant	q10-q14-1793428213936-concurrent-product	q10-q14-1793428213936-concurrent-batch	2027-10-31 06:30:14.226	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 06:30:14.226	2026-10-31 06:30:14.246
q10-q14-1793428213936-conflicting-batch	q10-q14-1793428213936-conflicting-tenant	q10-q14-1793428213936-conflicting-product	q10-q14-1793428213936-conflicting-batch	2027-10-31 06:30:14.264	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 06:30:14.264	2026-10-31 06:30:14.284
q10-q14-1793428213936-rollback-batch	q10-q14-1793428213936-rollback-tenant	q10-q14-1793428213936-rollback-product	q10-q14-1793428213936-rollback-batch	2027-10-31 06:30:14.193	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 06:30:14.193	2026-10-31 11:14:12.764
q10-q14-1793428213936-b-batch	q10-q14-1793428213936-b-tenant	q10-q14-1793428213936-b-product	q10-q14-1793428213936-b-batch	2027-10-31 06:30:14.06	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 06:30:14.06	2026-10-31 11:14:12.819
q10-q14-1793428172549-rollback-batch	q10-q14-1793428172549-rollback-tenant	q10-q14-1793428172549-rollback-product	q10-q14-1793428172549-rollback-batch	2027-10-31 06:29:32.882	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 06:29:32.882	2026-10-31 11:26:39.399
q10-q14-1793428172549-b-batch	q10-q14-1793428172549-b-tenant	q10-q14-1793428172549-b-product	q10-q14-1793428172549-b-batch	2027-10-31 06:29:32.707	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 06:29:32.707	2026-10-31 11:30:12.057
q10-app-1793447603960-batch	q10-app-1793447603960-tenant	q10-app-1793447603960-product	q10-app-1793447603960-batch	2027-10-31 11:53:23.961	\N	\N	100.00	100	98	\N	\N	f	2026-10-31 11:53:23.961	2026-10-31 11:53:24.805
q10-q14-1793447682627-b-batch	q10-q14-1793447682627-b-tenant	q10-q14-1793447682627-b-product	q10-q14-1793447682627-b-batch	2027-10-31 11:54:42.739	\N	\N	100.00	10	10	\N	\N	f	2026-10-31 11:54:42.739	2026-10-31 11:54:42.739
q10-q14-1793447682627-a-batch	q10-q14-1793447682627-a-tenant	q10-q14-1793447682627-a-product	q10-q14-1793447682627-a-batch	2027-10-31 11:54:42.698	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 11:54:42.698	2026-10-31 11:54:42.794
q10-q14-1793447682627-uncertain-batch	q10-q14-1793447682627-uncertain-tenant	q10-q14-1793447682627-uncertain-product	q10-q14-1793447682627-uncertain-batch	2027-10-31 11:54:42.819	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 11:54:42.819	2026-10-31 11:54:42.838
q10-q14-1793447682627-rollback-batch	q10-q14-1793447682627-rollback-tenant	q10-q14-1793447682627-rollback-product	q10-q14-1793447682627-rollback-batch	2027-10-31 11:54:42.863	\N	\N	100.00	10	10	\N	\N	f	2026-10-31 11:54:42.863	2026-10-31 11:54:42.863
q10-q14-1793447682627-concurrent-batch	q10-q14-1793447682627-concurrent-tenant	q10-q14-1793447682627-concurrent-product	q10-q14-1793447682627-concurrent-batch	2027-10-31 11:54:42.897	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 11:54:42.897	2026-10-31 11:54:42.915
q10-q14-1793447682627-conflicting-batch	q10-q14-1793447682627-conflicting-tenant	q10-q14-1793447682627-conflicting-product	q10-q14-1793447682627-conflicting-batch	2027-10-31 11:54:42.93	\N	\N	100.00	10	9	\N	\N	f	2026-10-31 11:54:42.93	2026-10-31 11:54:42.947
q10-app-1793452881250-batch	q10-app-1793452881250-tenant	q10-app-1793452881250-product	q10-app-1793452881250-batch	2027-10-31 13:21:21.252	\N	\N	100.00	100	98	\N	\N	f	2026-10-31 13:21:21.252	2026-10-31 13:21:22.6
q10-app-1793453149906-batch	q10-app-1793453149906-tenant	q10-app-1793453149906-product	q10-app-1793453149906-batch	2027-10-31 13:25:49.908	\N	\N	100.00	100	98	\N	\N	f	2026-10-31 13:25:49.908	2026-10-31 13:25:51.616
gst_e2e_batch_a_a2e8b6aae5c3475aa6611ec953be7fcb	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	gst_e2e_product_a_0e5f741a296b4af6ad4cf0270cd49f27	A-1	\N	\N	\N	100.00	1	1	\N	\N	f	2026-10-31 13:29:28.512	2026-10-31 13:29:28.512
gst_e2e_batch_b_ff1062716630499f923f163ff17083c5	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	gst_e2e_product_b_38fb2ab9bb1a446b9c7476b42f8c2497	B-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:29:28.512	2026-10-31 13:29:28.512
gst_e2e_success_batch_428bf37e057949f19fe0e76702762439	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	gst_e2e_product_a_0e5f741a296b4af6ad4cf0270cd49f27	SUCCESS-1	\N	\N	\N	100.00	5	5	\N	\N	f	2026-10-31 13:29:28.512	2026-10-31 13:29:28.512
gst_e2e_batch_a_e9ace2b670154b6aa83ac95103282151	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_product_a_dd647e0a44a04492b3ae5c7424277e1e	A-1	\N	\N	\N	100.00	1	1	\N	\N	f	2026-10-31 13:29:43.689	2026-10-31 13:29:43.689
gst_e2e_batch_b_e350c92b9a634b2689bfb6e30ec7e5f9	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_product_b_86ef9cb4c46d43a5b69e2fa3322432b4	B-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:29:43.689	2026-10-31 13:29:43.689
gst_e2e_success_batch_7941a22d2b7449be8c9087d594c31cff	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_product_a_dd647e0a44a04492b3ae5c7424277e1e	SUCCESS-1	\N	\N	\N	100.00	5	5	\N	\N	f	2026-10-31 13:29:43.689	2026-10-31 13:29:43.689
gst_e2e_batch_a_2a4344bb6b714a32a871d6a5a1796fb0	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_product_a_98176164cbb747ef893682f89e6ec2a2	A-1	\N	\N	\N	100.00	1	1	\N	\N	f	2026-10-31 13:29:58.518	2026-10-31 13:29:58.518
gst_e2e_batch_b_041220c42ef1475cb83b73dfda2117f4	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_product_b_b430bdc432ce44328f05420a2315456e	B-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:29:58.518	2026-10-31 13:29:58.518
gst_e2e_success_batch_90f95efb63664388a514294608d87243	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_product_a_98176164cbb747ef893682f89e6ec2a2	SUCCESS-1	\N	\N	\N	100.00	5	5	\N	\N	f	2026-10-31 13:29:58.518	2026-10-31 13:29:58.518
gst_e2e_batch_a_5a4a61c9d6db4f8592bff45ae46df37b	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_product_a_85c96a47ac014220a91e997e63caf697	A-1	\N	\N	\N	100.00	1	1	\N	\N	f	2026-10-31 13:30:12.558	2026-10-31 13:30:12.558
gst_e2e_batch_b_e1b099862fda45aab950289b07193b35	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_product_b_09897df5b6d64f0d90b2ce710fc7c4c0	B-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:30:12.558	2026-10-31 13:30:12.558
gst_e2e_success_batch_271f5864ddd44763bc79948edada5a4b	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_product_a_85c96a47ac014220a91e997e63caf697	SUCCESS-1	\N	\N	\N	100.00	5	5	\N	\N	f	2026-10-31 13:30:12.558	2026-10-31 13:30:12.558
gst_e2e_batch_a_4cba84981d914f3b810d31def99480d0	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_product_a_7b2e376947094939a8ff8015cc8f64f0	A-1	\N	\N	\N	100.00	1	1	\N	\N	f	2026-10-31 13:31:24.678	2026-10-31 13:31:24.678
gst_e2e_batch_b_7339e717c31f4159b339593399c43511	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_product_b_ae73613f1ed5432a83f76a3bf90924a6	B-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:31:24.678	2026-10-31 13:31:24.678
gst_e2e_success_batch_5098f684772b4902838800c765455f90	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_product_a_7b2e376947094939a8ff8015cc8f64f0	SUCCESS-1	\N	\N	\N	100.00	5	5	\N	\N	f	2026-10-31 13:31:24.678	2026-10-31 13:31:24.678
gst_e2e_batch_b_966a4e9c4db041b0a6f3cf633f24cedd	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_product_b_ac2a8b0582324826ac0b91a516ac9480	B-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:32:42.82	2026-10-31 13:32:42.82
gst_e2e_success_batch_e60ca2e948194b59bae7d76cda6b13a9	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_product_a_1734ed203ca1435e8582715750964b0d	SUCCESS-1	\N	\N	\N	100.00	5	5	\N	\N	f	2026-10-31 13:32:42.82	2026-10-31 13:32:42.82
gst_e2e_batch_a_7f0ebdf726714100818eeeb28ae29d42	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_product_a_1734ed203ca1435e8582715750964b0d	A-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:32:42.82	2026-10-31 13:32:44.309
gst_e2e_batch_b_e12e0cca73614f8e817d0f69a813180c	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_product_b_9b2a31989304458583642fbabdad37e6	B-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:33:55.958	2026-10-31 13:33:55.958
gst_e2e_success_batch_f5a5ec9dfe2c49bab31274bd1882f83a	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_product_a_fdf4a40153c5437a9ecb579368dedc61	SUCCESS-1	\N	\N	\N	100.00	5	5	\N	\N	f	2026-10-31 13:33:55.958	2026-10-31 13:33:55.958
gst_e2e_batch_a_8d53732f280d48a3aa1987840e67dfe8	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_product_a_fdf4a40153c5437a9ecb579368dedc61	A-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:33:55.958	2026-10-31 13:33:57.459
cmvwfzncv000pza3tjjfzum1p	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_product_a_fdf4a40153c5437a9ecb579368dedc61	SUCCESS-P-1	\N	\N	50.00	\N	2	2	gst_e2e_supplier_509a773065f1481795c14132bcdf8946	gst_e2e_purchase_success_ce69ce80a135405083eb65af66d4e5d2	f	2026-10-31 13:33:57.63	2026-10-31 13:33:57.63
gst_e2e_batch_b_0ee6a1d99d664ad69ba03bb5b1a7f99e	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_product_b_3a13466a6dec4e50b2620ed9f0d19564	B-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:35:09.31	2026-10-31 13:35:09.31
gst_e2e_success_batch_8bb785415e724773a40c93907a3b3500	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_product_a_30bbee97d538445f8ca1dcf448323e54	SUCCESS-1	\N	\N	\N	100.00	5	5	\N	\N	f	2026-10-31 13:35:09.31	2026-10-31 13:35:09.31
gst_e2e_batch_a_4e3d69037d3c45adb857a9ddf01dcdd6	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_product_a_30bbee97d538445f8ca1dcf448323e54	A-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:35:09.31	2026-10-31 13:35:10.753
cmvwg17xh000plgotj8wajsbk	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_product_a_30bbee97d538445f8ca1dcf448323e54	SUCCESS-P-1	\N	\N	50.00	\N	2	2	gst_e2e_supplier_f57df7e735f3462bac1432e6082cf6d5	gst_e2e_purchase_success_53face98828d459ea964e6ea9de2adb0	f	2026-10-31 13:35:10.946	2026-10-31 13:35:10.946
gst_e2e_batch_b_f66989f768b84079b5b3d152bc74a95a	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_product_b_51b5694b5fed4ce4af0d7a34685c9e71	B-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:36:28.408	2026-10-31 13:36:28.408
gst_e2e_success_batch_121719be72b24b109f688b7e5c453d22	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_product_a_85f2971d05db4af59a4e72f1bcd81079	SUCCESS-1	\N	\N	\N	100.00	5	5	\N	\N	f	2026-10-31 13:36:28.408	2026-10-31 13:36:28.408
gst_e2e_batch_a_055b24662b594ebbaad6796af3c631d3	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_product_a_85f2971d05db4af59a4e72f1bcd81079	A-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:36:28.408	2026-10-31 13:36:30.198
cmvwg2x76000p2plh2w0cy4qg	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_product_a_85f2971d05db4af59a4e72f1bcd81079	SUCCESS-P-1	\N	\N	50.00	\N	2	2	gst_e2e_supplier_b480da5f573d495fb4e753482b2abe9e	gst_e2e_purchase_success_396c53317f354bc18e427271a7ab8604	f	2026-10-31 13:36:30.353	2026-10-31 13:36:30.353
gst_e2e_batch_b_e2fc2dbbfd5444079ffbd9d6330bfb56	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_product_b_7bfcd52cab084c1fab273c357ded03b7	B-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:37:50.384	2026-10-31 13:37:50.384
gst_e2e_success_batch_342292d72f8e4cc4b05d8cae11708c2b	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_product_a_799cb53d442f4628a904adc8b69291aa	SUCCESS-1	\N	\N	\N	100.00	5	5	\N	\N	f	2026-10-31 13:37:50.384	2026-10-31 13:37:50.384
gst_e2e_batch_a_bfebe928dd1942f5a8218a899c782443	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_product_a_799cb53d442f4628a904adc8b69291aa	A-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:37:50.384	2026-10-31 13:37:51.605
cmvwg4nzl000p14oz9y8yh7qt	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_product_a_799cb53d442f4628a904adc8b69291aa	SUCCESS-P-1	\N	\N	50.00	\N	2	2	gst_e2e_supplier_c63b60377e9d4a8fa15e5396112df0f2	gst_e2e_purchase_success_1f164fb2783447d69f85f7df093931fa	f	2026-10-31 13:37:51.728	2026-10-31 13:37:51.728
gst_e2e_batch_b_af7e39e45b46467f863700487826e8ab	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_product_b_9ec21ef95cec49baa32ddb5e1725fc28	B-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:39:14.029	2026-10-31 13:39:14.029
gst_e2e_success_batch_8440d4c3a39149bc9acd36a8ca06f009	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_product_a_7473b483cbdd42bb9b764d186206acd7	SUCCESS-1	\N	\N	\N	100.00	5	5	\N	\N	f	2026-10-31 13:39:14.029	2026-10-31 13:39:14.029
gst_e2e_batch_a_0d21bfc815624b91bc873ec459211eb4	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_product_a_7473b483cbdd42bb9b764d186206acd7	A-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:39:14.029	2026-10-31 13:39:15.348
cmvwg6glq000pkez52eq7noht	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_product_a_7473b483cbdd42bb9b764d186206acd7	SUCCESS-P-1	\N	\N	50.00	\N	2	2	gst_e2e_supplier_f40058d4fa5446239501e43c0d3334ec	gst_e2e_purchase_success_f29700e5a951456bb04d6db56b016c68	f	2026-10-31 13:39:15.469	2026-10-31 13:39:15.469
gst_e2e_batch_b_87d52e428e94421b9b7d66d582716163	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_product_b_c4870b96d1774df68844834792a2783e	B-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:40:27.581	2026-10-31 13:40:27.581
gst_e2e_success_batch_3f6e084c37b64f6ab8e0137e3e1c20f4	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_product_a_ae05cfb72eaa42aabcc0996a8359d276	SUCCESS-1	\N	\N	\N	100.00	5	5	\N	\N	f	2026-10-31 13:40:27.581	2026-10-31 13:40:27.581
gst_e2e_batch_a_5e7293740c3d4610959494eb1f4ff8ca	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_product_a_ae05cfb72eaa42aabcc0996a8359d276	A-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:40:27.581	2026-10-31 13:40:28.851
cmvwg81bw000pemkispmxctm3	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_product_a_ae05cfb72eaa42aabcc0996a8359d276	SUCCESS-P-1	\N	\N	50.00	\N	2	2	gst_e2e_supplier_8b18212293a643b286fb03dcaf60f778	gst_e2e_purchase_success_d51c27ab43b145f195d586fed5ac6f01	f	2026-10-31 13:40:28.987	2026-10-31 13:40:28.987
gst_e2e_batch_b_3607aab0addc4656b5eeee3c6aebbf51	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_product_b_e4d26bf6051e4c3c87bee38273d433f0	B-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:41:41.091	2026-10-31 13:41:41.091
gst_e2e_success_batch_ad33f9b7b64142d48c4030ffde4557e8	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_product_a_c5b641f60f2b47f78bedf11520bf4bf8	SUCCESS-1	\N	\N	\N	100.00	5	5	\N	\N	f	2026-10-31 13:41:41.091	2026-10-31 13:41:41.091
gst_e2e_batch_a_2079e4168b6644e483d0ccb93a2cea38	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_product_a_c5b641f60f2b47f78bedf11520bf4bf8	A-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:41:41.091	2026-10-31 13:41:42.745
cmvwg9mcv000pdaach39l4l6d	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_product_a_c5b641f60f2b47f78bedf11520bf4bf8	SUCCESS-P-1	\N	\N	50.00	\N	2	2	gst_e2e_supplier_94e79b4473e043ff816317b0b593d282	gst_e2e_purchase_success_aaefa95e91204a878b000841573921e3	f	2026-10-31 13:41:42.893	2026-10-31 13:41:42.893
gst_e2e_batch_b_66bdbda9c3ef4428b84df4ebef44fc43	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_product_b_b2c16c8e2ae6497c90861fc61c9ac163	B-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:42:54.027	2026-10-31 13:42:54.027
gst_e2e_success_batch_2f3674f3f91748f6902210a5cfef1aad	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_product_a_90580835eb21424b947a18e5b7a00cf0	SUCCESS-1	\N	\N	\N	100.00	5	5	\N	\N	f	2026-10-31 13:42:54.027	2026-10-31 13:42:54.027
gst_e2e_batch_a_2655efbb72c642a28d13d5b546923cb4	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_product_a_90580835eb21424b947a18e5b7a00cf0	A-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:42:54.027	2026-10-31 13:42:55.602
cmvwgb6l9000pvg91w2h19iw0	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_product_a_90580835eb21424b947a18e5b7a00cf0	SUCCESS-P-1	\N	\N	50.00	\N	2	2	gst_e2e_supplier_056f63b10ffa45f5a326b206d1a237e2	gst_e2e_purchase_success_b47ae86c87784e399a738d3dc2c10eac	f	2026-10-31 13:42:55.772	2026-10-31 13:42:55.772
gst_e2e_batch_b_c2a2fa40ba514406ac6dd4b0b329c4cc	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_product_b_a19da0991c634e3b9c9c424eefe6eb04	B-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:44:31.539	2026-10-31 13:44:31.539
gst_e2e_success_batch_ce39cd9ae2b74cffa21bc660afe91dea	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_product_a_f2815984af604069a7e49a67c2a505ec	SUCCESS-1	\N	\N	\N	100.00	5	5	\N	\N	f	2026-10-31 13:44:31.539	2026-10-31 13:44:31.539
gst_e2e_batch_a_abd9959e4d974a6b8d27f59e65d46f46	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_product_a_f2815984af604069a7e49a67c2a505ec	A-1	\N	\N	\N	100.00	1	0	\N	\N	f	2026-10-31 13:44:31.539	2026-10-31 13:44:33.178
cmvwgd9wa000petespr4ealpu	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_product_a_f2815984af604069a7e49a67c2a505ec	SUCCESS-P-1	\N	\N	50.00	\N	2	2	gst_e2e_supplier_61ddcc9df9ab450bbe6a88eef8d031d0	gst_e2e_purchase_success_f1dc1040426446d1986b7570aedcf581	f	2026-10-31 13:44:33.369	2026-10-31 13:44:33.369
q10-app-1793454341866-batch	q10-app-1793454341866-tenant	q10-app-1793454341866-product	q10-app-1793454341866-batch	2027-10-31 13:45:41.869	\N	\N	100.00	100	98	\N	\N	f	2026-10-31 13:45:41.869	2026-10-31 13:45:43.54
q10-app-1793454409161-batch	q10-app-1793454409161-tenant	q10-app-1793454409161-product	q10-app-1793454409161-batch	2027-10-31 13:46:49.162	\N	\N	100.00	100	98	\N	\N	f	2026-10-31 13:46:49.162	2026-10-31 13:46:50.65
q10-app-1793454491946-batch	q10-app-1793454491946-tenant	q10-app-1793454491946-product	q10-app-1793454491946-batch	2027-10-31 13:48:11.948	\N	\N	100.00	100	98	\N	\N	f	2026-10-31 13:48:11.948	2026-10-31 13:48:13.186
q10-app-1793460716221-batch	q10-app-1793460716221-tenant	q10-app-1793460716221-product	q10-app-1793460716221-batch	2027-10-31 15:31:56.222	\N	\N	100.00	100	100	\N	\N	f	2026-10-31 15:31:56.222	2026-10-31 15:31:56.222
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.products (id, tenant_id, sku, name, generic_name, manufacturer, pack_size, hsn_code, gst_rate, schedule_classification, mrp, standard_sale_rate, purchase_rate, reorder_level, is_active, created_at, updated_at, created_by) FROM stdin;
q10-q14-1793420207911-a-product	q10-q14-1793420207911-a-tenant	\N	Synthetic Product a	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:16:47.969	2026-10-31 04:16:47.969	\N
q10-q14-1793420207911-b-product	q10-q14-1793420207911-b-tenant	\N	Synthetic Product b	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:16:48.008	2026-10-31 04:16:48.008	\N
q10-q14-1793420214519-a-product	q10-q14-1793420214519-a-tenant	\N	Synthetic Product a	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:16:54.574	2026-10-31 04:16:54.574	\N
q10-q14-1793420214519-b-product	q10-q14-1793420214519-b-tenant	\N	Synthetic Product b	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:16:54.615	2026-10-31 04:16:54.615	\N
q10-q14-1793420220210-a-product	q10-q14-1793420220210-a-tenant	\N	Synthetic Product a	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:17:00.268	2026-10-31 04:17:00.268	\N
q10-q14-1793420220210-b-product	q10-q14-1793420220210-b-tenant	\N	Synthetic Product b	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:17:00.306	2026-10-31 04:17:00.306	\N
q10-q14-1793420220210-rollback-product	q10-q14-1793420220210-rollback-tenant	\N	Synthetic Product rollback	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:17:00.393	2026-10-31 04:17:00.393	\N
q10-q14-1793420220210-concurrent-product	q10-q14-1793420220210-concurrent-tenant	\N	Synthetic Product concurrent	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:17:00.434	2026-10-31 04:17:00.434	\N
q10-q14-1793420348045-a-product	q10-q14-1793420348045-a-tenant	\N	Synthetic Product a	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:19:08.093	2026-10-31 04:19:08.093	\N
q10-q14-1793420348045-b-product	q10-q14-1793420348045-b-tenant	\N	Synthetic Product b	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:19:08.125	2026-10-31 04:19:08.125	\N
q10-q14-1793420355327-a-product	q10-q14-1793420355327-a-tenant	\N	Synthetic Product a	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:19:15.377	2026-10-31 04:19:15.377	\N
q10-q14-1793420355327-b-product	q10-q14-1793420355327-b-tenant	\N	Synthetic Product b	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:19:15.409	2026-10-31 04:19:15.409	\N
q10-q14-1793420355327-uncertain-product	q10-q14-1793420355327-uncertain-tenant	\N	Synthetic Product uncertain	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:19:15.469	2026-10-31 04:19:15.469	\N
q10-q14-1793420355327-rollback-product	q10-q14-1793420355327-rollback-tenant	\N	Synthetic Product rollback	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:19:15.508	2026-10-31 04:19:15.508	\N
q10-q14-1793420355327-concurrent-product	q10-q14-1793420355327-concurrent-tenant	\N	Synthetic Product concurrent	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:19:15.538	2026-10-31 04:19:15.538	\N
q10-q14-1793420355327-conflicting-product	q10-q14-1793420355327-conflicting-tenant	\N	Synthetic Product conflicting	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:19:15.573	2026-10-31 04:19:15.573	\N
q10-q14-1793421051032-a-product	q10-q14-1793421051032-a-tenant	\N	Synthetic Product a	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:30:51.126	2026-10-31 04:30:51.126	\N
q10-q14-1793421051032-b-product	q10-q14-1793421051032-b-tenant	\N	Synthetic Product b	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:30:51.203	2026-10-31 04:30:51.203	\N
q10-q14-1793421051032-uncertain-product	q10-q14-1793421051032-uncertain-tenant	\N	Synthetic Product uncertain	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:30:51.365	2026-10-31 04:30:51.365	\N
q10-q14-1793421051032-rollback-product	q10-q14-1793421051032-rollback-tenant	\N	Synthetic Product rollback	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:30:51.468	2026-10-31 04:30:51.468	\N
q10-q14-1793421051032-concurrent-product	q10-q14-1793421051032-concurrent-tenant	\N	Synthetic Product concurrent	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:30:51.534	2026-10-31 04:30:51.534	\N
q10-q14-1793421051032-conflicting-product	q10-q14-1793421051032-conflicting-tenant	\N	Synthetic Product conflicting	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:30:51.605	2026-10-31 04:30:51.605	\N
q10-q14-1793421102644-a-product	q10-q14-1793421102644-a-tenant	\N	Synthetic Product a	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:31:42.721	2026-10-31 04:31:42.721	\N
q10-q14-1793421102644-b-product	q10-q14-1793421102644-b-tenant	\N	Synthetic Product b	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:31:42.753	2026-10-31 04:31:42.753	\N
q10-q14-1793421102644-uncertain-product	q10-q14-1793421102644-uncertain-tenant	\N	Synthetic Product uncertain	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:31:42.822	2026-10-31 04:31:42.822	\N
q10-q14-1793421102644-rollback-product	q10-q14-1793421102644-rollback-tenant	\N	Synthetic Product rollback	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:31:42.862	2026-10-31 04:31:42.862	\N
q10-q14-1793421102644-concurrent-product	q10-q14-1793421102644-concurrent-tenant	\N	Synthetic Product concurrent	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:31:42.892	2026-10-31 04:31:42.892	\N
q10-q14-1793421102644-conflicting-product	q10-q14-1793421102644-conflicting-tenant	\N	Synthetic Product conflicting	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:31:42.928	2026-10-31 04:31:42.928	\N
q10-q14-1793421202430-a-product	q10-q14-1793421202430-a-tenant	\N	Synthetic Product a	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:33:22.534	2026-10-31 04:33:22.534	\N
q10-q14-1793421202430-b-product	q10-q14-1793421202430-b-tenant	\N	Synthetic Product b	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:33:22.583	2026-10-31 04:33:22.583	\N
q10-q14-1793421202430-uncertain-product	q10-q14-1793421202430-uncertain-tenant	\N	Synthetic Product uncertain	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:33:22.696	2026-10-31 04:33:22.696	\N
q10-q14-1793421202430-rollback-product	q10-q14-1793421202430-rollback-tenant	\N	Synthetic Product rollback	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:33:22.771	2026-10-31 04:33:22.771	\N
q10-q14-1793421202430-concurrent-product	q10-q14-1793421202430-concurrent-tenant	\N	Synthetic Product concurrent	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:33:22.819	2026-10-31 04:33:22.819	\N
q10-q14-1793421202430-conflicting-product	q10-q14-1793421202430-conflicting-tenant	\N	Synthetic Product conflicting	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:33:22.877	2026-10-31 04:33:22.877	\N
q10-q14-1793421457888-a-product	q10-q14-1793421457888-a-tenant	\N	Synthetic Product a	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:37:37.984	2026-10-31 04:37:37.984	\N
q10-q14-1793421457888-b-product	q10-q14-1793421457888-b-tenant	\N	Synthetic Product b	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:37:38.019	2026-10-31 04:37:38.019	\N
q10-q14-1793421457888-uncertain-product	q10-q14-1793421457888-uncertain-tenant	\N	Synthetic Product uncertain	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:37:38.092	2026-10-31 04:37:38.092	\N
q10-q14-1793421457888-rollback-product	q10-q14-1793421457888-rollback-tenant	\N	Synthetic Product rollback	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:37:38.14	2026-10-31 04:37:38.14	\N
q10-q14-1793421457888-concurrent-product	q10-q14-1793421457888-concurrent-tenant	\N	Synthetic Product concurrent	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:37:38.176	2026-10-31 04:37:38.176	\N
q10-q14-1793421457888-conflicting-product	q10-q14-1793421457888-conflicting-tenant	\N	Synthetic Product conflicting	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:37:38.215	2026-10-31 04:37:38.215	\N
q10-q14-1793421934870-a-product	q10-q14-1793421934870-a-tenant	\N	Synthetic Product a	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:45:34.921	2026-10-31 04:45:34.921	\N
q10-q14-1793421934870-b-product	q10-q14-1793421934870-b-tenant	\N	Synthetic Product b	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:45:34.942	2026-10-31 04:45:34.942	\N
q10-q14-1793421934870-uncertain-product	q10-q14-1793421934870-uncertain-tenant	\N	Synthetic Product uncertain	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:45:34.984	2026-10-31 04:45:34.984	\N
q10-q14-1793421934870-rollback-product	q10-q14-1793421934870-rollback-tenant	\N	Synthetic Product rollback	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:45:35.008	2026-10-31 04:45:35.008	\N
q10-q14-1793421934870-concurrent-product	q10-q14-1793421934870-concurrent-tenant	\N	Synthetic Product concurrent	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:45:35.026	2026-10-31 04:45:35.026	\N
q10-q14-1793421934870-conflicting-product	q10-q14-1793421934870-conflicting-tenant	\N	Synthetic Product conflicting	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 04:45:35.047	2026-10-31 04:45:35.047	\N
q14-1793428127358-product-a	q14-1793428127358-tenant-a	\N	Q14 Product A	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:28:47.406	2026-10-31 06:28:47.406	\N
q14-1793428127358-product-b	q14-1793428127358-tenant-a	\N	Q14 Product B	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:28:47.406	2026-10-31 06:28:47.406	\N
q14-1793428127358-product-expired	q14-1793428127358-tenant-a	\N	Q14 Product Expired	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:28:47.406	2026-10-31 06:28:47.406	\N
q14-1793428135758-product-a	q14-1793428135758-tenant-a	\N	Q14 Product A	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:28:55.817	2026-10-31 06:28:55.817	\N
q14-1793428135758-product-b	q14-1793428135758-tenant-a	\N	Q14 Product B	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:28:55.817	2026-10-31 06:28:55.817	\N
q14-1793428135758-product-expired	q14-1793428135758-tenant-a	\N	Q14 Product Expired	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:28:55.817	2026-10-31 06:28:55.817	\N
q14-1793428141699-product-a	q14-1793428141699-tenant-a	\N	Q14 Product A	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:29:01.758	2026-10-31 06:29:01.758	\N
q14-1793428141699-product-b	q14-1793428141699-tenant-a	\N	Q14 Product B	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:29:01.758	2026-10-31 06:29:01.758	\N
q14-1793428141699-product-expired	q14-1793428141699-tenant-a	\N	Q14 Product Expired	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:29:01.758	2026-10-31 06:29:01.758	\N
q14-1793428156995-product-b	q14-1793428156995-tenant-a	\N	Q14 Product B	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:29:17.057	2026-10-31 06:29:17.057	\N
q14-1793428156995-product-expired	q14-1793428156995-tenant-a	\N	Q14 Product Expired	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:29:17.057	2026-10-31 06:29:17.057	\N
q14-1793428156995-product-a	q14-1793428156995-tenant-a	\N	Q14 Product A	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	f	2026-10-31 06:29:17.057	2026-10-31 06:29:17.146	\N
q14-1793428163409-product-b	q14-1793428163409-tenant-a	\N	Q14 Product B	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:29:23.472	2026-10-31 06:29:23.472	\N
q14-1793428163409-product-a	q14-1793428163409-tenant-a	\N	Q14 Product A	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	f	2026-10-31 06:29:23.472	2026-10-31 06:29:23.553	\N
q14-1793428163409-product-expired	q14-1793428163409-tenant-a	\N	Q14 Product Expired	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:29:23.472	2026-10-31 06:29:23.472	\N
q14-1793428169511-product-b	q14-1793428169511-tenant-a	\N	Q14 Product B	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:29:29.575	2026-10-31 06:29:29.575	\N
q14-1793428169511-product-a	q14-1793428169511-tenant-a	\N	Q14 Product A	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	f	2026-10-31 06:29:29.575	2026-10-31 06:29:29.669	\N
q14-1793428169511-product-expired	q14-1793428169511-tenant-a	\N	Q14 Product Expired	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:29:29.575	2026-10-31 06:29:29.575	\N
q10-q14-1793428172549-a-product	q10-q14-1793428172549-a-tenant	\N	Synthetic Product a	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:29:32.66	2026-10-31 06:29:32.66	\N
q10-q14-1793428172549-b-product	q10-q14-1793428172549-b-tenant	\N	Synthetic Product b	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:29:32.707	2026-10-31 06:29:32.707	\N
q10-q14-1793428172549-uncertain-product	q10-q14-1793428172549-uncertain-tenant	\N	Synthetic Product uncertain	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:29:32.813	2026-10-31 06:29:32.813	\N
q10-q14-1793428172549-rollback-product	q10-q14-1793428172549-rollback-tenant	\N	Synthetic Product rollback	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:29:32.882	2026-10-31 06:29:32.882	\N
q10-q14-1793428172549-concurrent-product	q10-q14-1793428172549-concurrent-tenant	\N	Synthetic Product concurrent	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:29:32.931	2026-10-31 06:29:32.931	\N
q10-q14-1793428172549-conflicting-product	q10-q14-1793428172549-conflicting-tenant	\N	Synthetic Product conflicting	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:29:32.989	2026-10-31 06:29:32.989	\N
q14-1793428213621-product-b	q14-1793428213621-tenant-a	\N	Q14 Product B	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:30:13.676	2026-10-31 06:30:13.676	\N
q14-1793428213621-product-a	q14-1793428213621-tenant-a	\N	Q14 Product A	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	f	2026-10-31 06:30:13.676	2026-10-31 06:30:13.739	\N
q14-1793428213621-product-expired	q14-1793428213621-tenant-a	\N	Q14 Product Expired	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:30:13.676	2026-10-31 06:30:13.676	\N
q10-q14-1793428213936-a-product	q10-q14-1793428213936-a-tenant	\N	Synthetic Product a	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:30:14.025	2026-10-31 06:30:14.025	\N
q10-q14-1793428213936-b-product	q10-q14-1793428213936-b-tenant	\N	Synthetic Product b	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:30:14.06	2026-10-31 06:30:14.06	\N
q10-q14-1793428213936-uncertain-product	q10-q14-1793428213936-uncertain-tenant	\N	Synthetic Product uncertain	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:30:14.142	2026-10-31 06:30:14.142	\N
q10-q14-1793428213936-rollback-product	q10-q14-1793428213936-rollback-tenant	\N	Synthetic Product rollback	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:30:14.193	2026-10-31 06:30:14.193	\N
q10-q14-1793428213936-concurrent-product	q10-q14-1793428213936-concurrent-tenant	\N	Synthetic Product concurrent	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:30:14.226	2026-10-31 06:30:14.226	\N
q10-q14-1793428213936-conflicting-product	q10-q14-1793428213936-conflicting-tenant	\N	Synthetic Product conflicting	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 06:30:14.264	2026-10-31 06:30:14.264	\N
q10-app-1793446286377-product	q10-app-1793446286377-tenant	\N	Q10 Application Product	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:31:26.379	2026-10-31 11:31:26.379	\N
q10-app-1793446489184-product	q10-app-1793446489184-tenant	\N	Q10 Application Product	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:34:49.185	2026-10-31 11:34:49.185	\N
q10-app-1793446623070-product	q10-app-1793446623070-tenant	\N	Q10 Application Product	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:37:03.072	2026-10-31 11:37:03.072	\N
q14-1793446696706-product-b	q14-1793446696706-tenant-a	\N	Q14 Product B	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:38:16.823	2026-10-31 11:38:16.823	\N
q14-1793446696706-product-a	q14-1793446696706-tenant-a	\N	Q14 Product A	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	f	2026-10-31 11:38:16.823	2026-10-31 11:38:16.943	\N
q14-1793446696706-product-expired	q14-1793446696706-tenant-a	\N	Q14 Product Expired	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:38:16.823	2026-10-31 11:38:16.823	\N
q10-q14-1793446761696-a-product	q10-q14-1793446761696-a-tenant	\N	Synthetic Product a	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:39:21.775	2026-10-31 11:39:21.775	\N
q10-q14-1793446761696-b-product	q10-q14-1793446761696-b-tenant	\N	Synthetic Product b	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:39:21.805	2026-10-31 11:39:21.805	\N
q10-q14-1793446761696-uncertain-product	q10-q14-1793446761696-uncertain-tenant	\N	Synthetic Product uncertain	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:39:21.875	2026-10-31 11:39:21.875	\N
q10-q14-1793446761696-rollback-product	q10-q14-1793446761696-rollback-tenant	\N	Synthetic Product rollback	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:39:21.92	2026-10-31 11:39:21.92	\N
q10-q14-1793446761696-concurrent-product	q10-q14-1793446761696-concurrent-tenant	\N	Synthetic Product concurrent	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:39:21.948	2026-10-31 11:39:21.948	\N
q10-q14-1793446761696-conflicting-product	q10-q14-1793446761696-conflicting-tenant	\N	Synthetic Product conflicting	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:39:21.986	2026-10-31 11:39:21.986	\N
q10-app-1793447402381-product	q10-app-1793447402381-tenant	\N	Q10 Application Product	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:50:02.383	2026-10-31 11:50:02.383	\N
q10-app-1793447603960-product	q10-app-1793447603960-tenant	\N	Q10 Application Product	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:53:23.961	2026-10-31 11:53:23.961	\N
q10-q14-1793447682627-a-product	q10-q14-1793447682627-a-tenant	\N	Synthetic Product a	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:54:42.698	2026-10-31 11:54:42.698	\N
q10-q14-1793447682627-b-product	q10-q14-1793447682627-b-tenant	\N	Synthetic Product b	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:54:42.739	2026-10-31 11:54:42.739	\N
q10-q14-1793447682627-uncertain-product	q10-q14-1793447682627-uncertain-tenant	\N	Synthetic Product uncertain	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:54:42.819	2026-10-31 11:54:42.819	\N
q10-q14-1793447682627-rollback-product	q10-q14-1793447682627-rollback-tenant	\N	Synthetic Product rollback	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:54:42.863	2026-10-31 11:54:42.863	\N
q10-q14-1793447682627-concurrent-product	q10-q14-1793447682627-concurrent-tenant	\N	Synthetic Product concurrent	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:54:42.897	2026-10-31 11:54:42.897	\N
q10-q14-1793447682627-conflicting-product	q10-q14-1793447682627-conflicting-tenant	\N	Synthetic Product conflicting	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:54:42.93	2026-10-31 11:54:42.93	\N
q14-1793447733823-product-b	q14-1793447733823-tenant-a	\N	Q14 Product B	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:55:33.974	2026-10-31 11:55:33.974	\N
q14-1793447733823-product-a	q14-1793447733823-tenant-a	\N	Q14 Product A	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	f	2026-10-31 11:55:33.974	2026-10-31 11:55:34.04	\N
q14-1793447733823-product-expired	q14-1793447733823-tenant-a	\N	Q14 Product Expired	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 11:55:33.974	2026-10-31 11:55:33.974	\N
q10-app-1793452881250-product	q10-app-1793452881250-tenant	\N	Q10 Application Product	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:21:21.252	2026-10-31 13:21:21.252	\N
q14-1793452880879-product-b	q14-1793452880879-tenant-a	\N	Q14 Product B	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:21:21.319	2026-10-31 13:21:21.319	\N
q14-1793452880879-product-a	q14-1793452880879-tenant-a	\N	Q14 Product A	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	f	2026-10-31 13:21:21.319	2026-10-31 13:21:21.504	\N
q14-1793452880879-product-expired	q14-1793452880879-tenant-a	\N	Q14 Product Expired	\N	\N	\N	Q14	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:21:21.319	2026-10-31 13:21:21.319	\N
q10-app-1793453149906-product	q10-app-1793453149906-tenant	\N	Q10 Application Product	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:25:49.908	2026-10-31 13:25:49.908	\N
gst_e2e_product_a_0e5f741a296b4af6ad4cf0270cd49f27	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	\N	GST Product A	GST Product A Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:29:28.512	2026-10-31 13:29:28.512	\N
gst_e2e_product_b_38fb2ab9bb1a446b9c7476b42f8c2497	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	\N	GST Product B	GST Product B Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:29:28.512	2026-10-31 13:29:28.512	\N
gst_e2e_product_a_dd647e0a44a04492b3ae5c7424277e1e	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	\N	GST Product A	GST Product A Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:29:43.689	2026-10-31 13:29:43.689	\N
gst_e2e_product_b_86ef9cb4c46d43a5b69e2fa3322432b4	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	\N	GST Product B	GST Product B Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:29:43.689	2026-10-31 13:29:43.689	\N
gst_e2e_product_a_98176164cbb747ef893682f89e6ec2a2	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	\N	GST Product A	GST Product A Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:29:58.518	2026-10-31 13:29:58.518	\N
gst_e2e_product_b_b430bdc432ce44328f05420a2315456e	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	\N	GST Product B	GST Product B Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:29:58.518	2026-10-31 13:29:58.518	\N
gst_e2e_product_a_85c96a47ac014220a91e997e63caf697	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	\N	GST Product A	GST Product A Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:30:12.558	2026-10-31 13:30:12.558	\N
gst_e2e_product_b_09897df5b6d64f0d90b2ce710fc7c4c0	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	\N	GST Product B	GST Product B Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:30:12.558	2026-10-31 13:30:12.558	\N
gst_e2e_product_a_7b2e376947094939a8ff8015cc8f64f0	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	\N	GST Product A	GST Product A Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:31:24.678	2026-10-31 13:31:24.678	\N
gst_e2e_product_b_ae73613f1ed5432a83f76a3bf90924a6	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	\N	GST Product B	GST Product B Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:31:24.678	2026-10-31 13:31:24.678	\N
gst_e2e_product_a_1734ed203ca1435e8582715750964b0d	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	\N	GST Product A	GST Product A Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:32:42.82	2026-10-31 13:32:42.82	\N
gst_e2e_product_b_ac2a8b0582324826ac0b91a516ac9480	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	\N	GST Product B	GST Product B Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:32:42.82	2026-10-31 13:32:42.82	\N
gst_e2e_product_a_fdf4a40153c5437a9ecb579368dedc61	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	\N	GST Product A	GST Product A Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:33:55.958	2026-10-31 13:33:55.958	\N
gst_e2e_product_b_9b2a31989304458583642fbabdad37e6	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	\N	GST Product B	GST Product B Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:33:55.958	2026-10-31 13:33:55.958	\N
gst_e2e_product_a_30bbee97d538445f8ca1dcf448323e54	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	\N	GST Product A	GST Product A Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:35:09.31	2026-10-31 13:35:09.31	\N
gst_e2e_product_b_3a13466a6dec4e50b2620ed9f0d19564	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	\N	GST Product B	GST Product B Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:35:09.31	2026-10-31 13:35:09.31	\N
gst_e2e_product_a_85f2971d05db4af59a4e72f1bcd81079	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	\N	GST Product A	GST Product A Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:36:28.408	2026-10-31 13:36:28.408	\N
gst_e2e_product_b_51b5694b5fed4ce4af0d7a34685c9e71	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	\N	GST Product B	GST Product B Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:36:28.408	2026-10-31 13:36:28.408	\N
gst_e2e_product_a_799cb53d442f4628a904adc8b69291aa	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	\N	GST Product A	GST Product A Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:37:50.384	2026-10-31 13:37:50.384	\N
gst_e2e_product_b_7bfcd52cab084c1fab273c357ded03b7	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	\N	GST Product B	GST Product B Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:37:50.384	2026-10-31 13:37:50.384	\N
gst_e2e_product_a_7473b483cbdd42bb9b764d186206acd7	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	\N	GST Product A	GST Product A Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:39:14.029	2026-10-31 13:39:14.029	\N
gst_e2e_product_b_9ec21ef95cec49baa32ddb5e1725fc28	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	\N	GST Product B	GST Product B Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:39:14.029	2026-10-31 13:39:14.029	\N
gst_e2e_product_a_ae05cfb72eaa42aabcc0996a8359d276	gst_e2e_tenant_19035406820a497699286f211ca126f6	\N	GST Product A	GST Product A Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:40:27.581	2026-10-31 13:40:27.581	\N
gst_e2e_product_b_c4870b96d1774df68844834792a2783e	gst_e2e_tenant_19035406820a497699286f211ca126f6	\N	GST Product B	GST Product B Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:40:27.581	2026-10-31 13:40:27.581	\N
gst_e2e_product_a_c5b641f60f2b47f78bedf11520bf4bf8	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	\N	GST Product A	GST Product A Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:41:41.091	2026-10-31 13:41:41.091	\N
gst_e2e_product_b_e4d26bf6051e4c3c87bee38273d433f0	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	\N	GST Product B	GST Product B Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:41:41.091	2026-10-31 13:41:41.091	\N
gst_e2e_product_b_b2c16c8e2ae6497c90861fc61c9ac163	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	\N	GST Product B	GST Product B Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:42:54.027	2026-10-31 13:42:54.027	\N
gst_e2e_product_a_90580835eb21424b947a18e5b7a00cf0	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	SNAP-001-EDITED	Changed Product	Changed Generic	\N	\N	9999	18.00	OTC	100.00	100.00	100.00	0	t	2026-10-31 13:42:54.027	2026-10-31 13:42:56.243	\N
gst_e2e_product_b_a19da0991c634e3b9c9c424eefe6eb04	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	\N	GST Product B	GST Product B Generic	\N	\N	3004	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:44:31.539	2026-10-31 13:44:31.539	\N
gst_e2e_product_a_f2815984af604069a7e49a67c2a505ec	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	SNAP-001-EDITED	Changed Product	Changed Generic	\N	\N	9999	18.00	OTC	100.00	100.00	100.00	0	t	2026-10-31 13:44:31.539	2026-10-31 13:44:34.138	\N
q10-app-1793454341866-product	q10-app-1793454341866-tenant	\N	Q10 Application Product	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:45:41.869	2026-10-31 13:45:41.869	\N
q10-app-1793454409161-product	q10-app-1793454409161-tenant	\N	Q10 Application Product	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:46:49.162	2026-10-31 13:46:49.162	\N
q10-app-1793454491946-product	q10-app-1793454491946-tenant	\N	Q10 Application Product	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 13:48:11.948	2026-10-31 13:48:11.948	\N
q10-app-1793460716221-product	q10-app-1793460716221-tenant	\N	Q10 Application Product	\N	\N	\N	SYNTHETIC	18.00	\N	\N	100.00	\N	0	t	2026-10-31 15:31:56.222	2026-10-31 15:31:56.222	\N
\.


--
-- Data for Name: purchase_gst_accounting_decisions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_gst_accounting_decisions (id, tenant_id, purchase_invoice_id, evidence_revision_id, calculation_id, accepted_taxable_value, accepted_cgst, accepted_sgst, accepted_igst, accepted_cess, accepted_invoice_total, accepted_round_off, accepted_value_source, decision_reference, decision_outcome, rationale, decided_at, decided_by_membership_id) FROM stdin;
gst_e2e_decision_ec088e1271964e72b141d740f8089816	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	gst_e2e_purchase_588bcf74620049639f3d530fe823607c	gst_e2e_evidence_6f9671b769a148328ecced283a8dd951	gst_e2e_calculation_2a152435de974f3189a4c24008ba3cd6	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-ACCEPT	ACCEPTED	E2E	2026-10-31 13:29:28.512	gst_e2e_membership_157ab353bc034261878493cdd101dba3
gst_e2e_success_decision_4253f209222142fba7c7f3e9dfe25209	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	gst_e2e_purchase_success_9f6de0f839f54ce6a06fe3294e289ca0	gst_e2e_success_evidence_67b50dbf0226457fbce26344c53eca6e	gst_e2e_success_calculation_3f0791e4e1bb4278829899b9cb920478	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-SUCCESS	ACCEPTED	E2E	2026-10-31 13:29:28.512	gst_e2e_membership_157ab353bc034261878493cdd101dba3
gst_e2e_decision_ee377380750d485b9aff1269283a8e52	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_purchase_f9ced06c11024da6a5119cb2ef66b937	gst_e2e_evidence_429e8f420fc14709ba8c35768402c1ca	gst_e2e_calculation_d91d442a17ea413e97a962c40ca7f1a2	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-ACCEPT	ACCEPTED	E2E	2026-10-31 13:29:43.689	gst_e2e_membership_cddf1b53e7a84908becdf020da632566
gst_e2e_success_decision_6ffb726de56b4ff391a821e02cecc434	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_purchase_success_a07e26b2f62b4c349358b2673fd282eb	gst_e2e_success_evidence_51416e49c9e7421b95597228e97429a6	gst_e2e_success_calculation_a7cb5b355c2446e1903cce1ee684e3a1	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-SUCCESS	ACCEPTED	E2E	2026-10-31 13:29:43.689	gst_e2e_membership_cddf1b53e7a84908becdf020da632566
gst_e2e_decision_a8d6804f3d684de0a1a2106803b8191e	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_purchase_fb99775d866b49c2aafb8081ca4f86eb	gst_e2e_evidence_26fb64cd64364a879e39645c664a9dea	gst_e2e_calculation_99ccc487fbec45fbbcb2ccd8f2cd5404	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-ACCEPT	ACCEPTED	E2E	2026-10-31 13:29:58.518	gst_e2e_membership_a30d0390f1da442d88966edb68bb68fd
gst_e2e_success_decision_9daf14dbcbbb4aa0b49db4de2479eedc	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_purchase_success_9915c8ac103b4eb4a9dbf0867e4d6f4b	gst_e2e_success_evidence_10d40fed778b490b900d1bb0b653cae0	gst_e2e_success_calculation_c921a9febdf546a3a4fa75afa8fd1a10	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-SUCCESS	ACCEPTED	E2E	2026-10-31 13:29:58.518	gst_e2e_membership_a30d0390f1da442d88966edb68bb68fd
gst_e2e_decision_ec6eed22843343ea8e9e62b296ee7bca	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_purchase_e2ca6a2055794c97873b657cbbe3dd88	gst_e2e_evidence_e40a554ef2884ed38e668e06c5d38614	gst_e2e_calculation_a39766b7fbf14160becd89939afbdf2d	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-ACCEPT	ACCEPTED	E2E	2026-10-31 13:30:12.558	gst_e2e_membership_dccfb3488bb9441893e2e576cc6fe8b2
gst_e2e_success_decision_6e84fa800bb142c18b99a6c957f214d0	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_purchase_success_df98e2d516d740b59362c02f0a0a568b	gst_e2e_success_evidence_8ea3794385e94ac0ad4a324b4d5ce034	gst_e2e_success_calculation_ce972a7046114a36bdd4f289db469f1b	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-SUCCESS	ACCEPTED	E2E	2026-10-31 13:30:12.558	gst_e2e_membership_dccfb3488bb9441893e2e576cc6fe8b2
gst_e2e_decision_70ac3ee091c0419b8c95127e9d30c834	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_purchase_98c3c1dc2f394d6da5829a69d8393314	gst_e2e_evidence_d14fdbed67fe46b2990c0b6b0d1fbabf	gst_e2e_calculation_ce33bcf3b2fc4f2d86945c3f94b82eee	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-ACCEPT	ACCEPTED	E2E	2026-10-31 13:31:24.678	gst_e2e_membership_1a2cf1d65db342089313b83dd482d91d
gst_e2e_success_decision_0ccc638ca1fd4f17a6e7442fd2525248	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_purchase_success_76ea8052134c4255bccb8912dbf8a483	gst_e2e_success_evidence_abf3b283504446cba52e4d2cfdbff12a	gst_e2e_success_calculation_f8bda4a0d8b5485ea70ee014462410b8	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-SUCCESS	ACCEPTED	E2E	2026-10-31 13:31:24.678	gst_e2e_membership_1a2cf1d65db342089313b83dd482d91d
gst_e2e_decision_1b6c80a8a80e4500873b6b92f35b3f9f	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_purchase_e1cd506f35d44abc874f0d767b4c1f9e	gst_e2e_evidence_fe75642589d8499d97173a74492d203c	gst_e2e_calculation_55f82681fe4d4b5899627254870c4a66	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-ACCEPT	ACCEPTED	E2E	2026-10-31 13:32:42.82	gst_e2e_membership_06a1cb1c6801491eb3e16edde3535f10
gst_e2e_success_decision_780e9829a864450b9c94286889230318	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_purchase_success_2fec4b5f9403413c9f5984a6c80596a7	gst_e2e_success_evidence_e4c32e05982c4a31aaf29dd46b1676d2	gst_e2e_success_calculation_660568ca7c2d46d186c6dd369a3ecb05	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-SUCCESS	ACCEPTED	E2E	2026-10-31 13:32:42.82	gst_e2e_membership_06a1cb1c6801491eb3e16edde3535f10
gst_e2e_decision_646af98a1ca640208da6831a2a3ecfb0	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_purchase_52aab46bb4c2488598a650643e7f9d5b	gst_e2e_evidence_bbf752e53f6a4ae8a3df3bf2755de704	gst_e2e_calculation_34f8800ed731440d883f225c50a4684e	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-ACCEPT	ACCEPTED	E2E	2026-10-31 13:33:55.958	gst_e2e_membership_c8d52f2d9d93451a8259ab0879be66cb
gst_e2e_success_decision_1c3eca69348c4952a52333575f45a0ef	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_purchase_success_ce69ce80a135405083eb65af66d4e5d2	gst_e2e_success_evidence_8c7e453e8f3d41a1bf9c0e702ab1607a	gst_e2e_success_calculation_30bbede44b124b48842d1f6ff37151f1	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-SUCCESS	ACCEPTED	E2E	2026-10-31 13:33:55.958	gst_e2e_membership_c8d52f2d9d93451a8259ab0879be66cb
gst_e2e_decision_a72365ff495145e385a8363c396d9f9a	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_purchase_5fd610274c2941c88d5597c4d81883a2	gst_e2e_evidence_60a7666d4cfe4d52892b37363704c0a8	gst_e2e_calculation_015e00442f27495e9c8126021064f659	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-ACCEPT	ACCEPTED	E2E	2026-10-31 13:35:09.31	gst_e2e_membership_21bfedf0ae6947e4829b40618e2cb7ec
gst_e2e_success_decision_6e2551eab23c4550ae1d5a64c4a85c0c	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_purchase_success_53face98828d459ea964e6ea9de2adb0	gst_e2e_success_evidence_ba68aa91cac44c6e9929649f15193d6e	gst_e2e_success_calculation_9490e79b1e524ac6839d3212e2d94fd8	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-SUCCESS	ACCEPTED	E2E	2026-10-31 13:35:09.31	gst_e2e_membership_21bfedf0ae6947e4829b40618e2cb7ec
gst_e2e_decision_b5b650eb56e940e0a159a7997cd7d0e2	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_purchase_3753f502598d4c098c1253bfdbeb1399	gst_e2e_evidence_be3a31ee61eb4bb39f8f74acb22bd228	gst_e2e_calculation_4bf9cc375c644d729e25d7065815816c	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-ACCEPT	ACCEPTED	E2E	2026-10-31 13:36:28.408	gst_e2e_membership_4c82e0f9df22462fa68e3b900d05de5c
gst_e2e_success_decision_910191ce0cdd4298b786e79a9a841d43	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_purchase_success_396c53317f354bc18e427271a7ab8604	gst_e2e_success_evidence_6224d0b13d8a41d3ac60973ed4702998	gst_e2e_success_calculation_512f5e04b46844b7a1888226774a787e	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-SUCCESS	ACCEPTED	E2E	2026-10-31 13:36:28.408	gst_e2e_membership_4c82e0f9df22462fa68e3b900d05de5c
gst_e2e_decision_e3a5af05e6844b3da38fde99e8b53b82	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_purchase_aa38f212da914bda918c06dc0dc8adf3	gst_e2e_evidence_7471892240924f08b7230dd222ae676c	gst_e2e_calculation_3e6392ed2c5548818aabc00b95162fd5	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-ACCEPT	ACCEPTED	E2E	2026-10-31 13:37:50.384	gst_e2e_membership_1fda0d27d95245bb8d215a787bd6ca7a
gst_e2e_success_decision_12a7badbc6734f15b1656434d51ee689	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_purchase_success_1f164fb2783447d69f85f7df093931fa	gst_e2e_success_evidence_8b0d0d4e0e354dfaa6cacf8bb5f0796e	gst_e2e_success_calculation_c7d3e4a852104d058bb5afeb66c0d57c	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-SUCCESS	ACCEPTED	E2E	2026-10-31 13:37:50.384	gst_e2e_membership_1fda0d27d95245bb8d215a787bd6ca7a
gst_e2e_decision_8347f88a4f88416d960ea798fbf25572	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_purchase_38e1c1314c35421aa667471b779fd8ed	gst_e2e_evidence_9bf2b25253a94cb18716fabf4462c32d	gst_e2e_calculation_0dd6d6dc45d94faebbdd86aff90e60d0	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-ACCEPT	ACCEPTED	E2E	2026-10-31 13:39:14.029	gst_e2e_membership_ccb7741181d042c3a7a11a78a50626b2
gst_e2e_success_decision_e1ca98178f104c5c9ee4b1291cda90fa	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_purchase_success_f29700e5a951456bb04d6db56b016c68	gst_e2e_success_evidence_003b9b9272074716b23b802714bac772	gst_e2e_success_calculation_827963418bd54ea6969c49c569e9e62a	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-SUCCESS	ACCEPTED	E2E	2026-10-31 13:39:14.029	gst_e2e_membership_ccb7741181d042c3a7a11a78a50626b2
gst_e2e_decision_f7ae5ed91ceb42c7adf2a48accfa760e	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_purchase_75279e266cd94fa19dcc9ba55b20d90e	gst_e2e_evidence_24845f17dc8c4f41b405d61b219154e7	gst_e2e_calculation_43385fa3b0134e16a271b0485dae43dc	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-ACCEPT	ACCEPTED	E2E	2026-10-31 13:40:27.581	gst_e2e_membership_5c263d013fa34469870be8eca0547662
gst_e2e_success_decision_cc459fed9e424115a10ddfa418f55851	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_purchase_success_d51c27ab43b145f195d586fed5ac6f01	gst_e2e_success_evidence_f6ff4a916855451d966f3a0a2e2914a1	gst_e2e_success_calculation_c9bc969a79304383920ad682cbaaa2c7	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-SUCCESS	ACCEPTED	E2E	2026-10-31 13:40:27.581	gst_e2e_membership_5c263d013fa34469870be8eca0547662
gst_e2e_decision_f8c548d7113a46a1889ff4ffd7521894	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_purchase_918bcf5b68ac49f9868815f7667ab03e	gst_e2e_evidence_c077e57256d74049b79ebf881c3bfcb9	gst_e2e_calculation_72a6392096d648c58f161d9cbb41b9f7	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-ACCEPT	ACCEPTED	E2E	2026-10-31 13:41:41.091	gst_e2e_membership_8c515a3dd23b43a29c97318b841800e1
gst_e2e_success_decision_b2413c39f4a6433f8eb2e72de83003d2	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_purchase_success_aaefa95e91204a878b000841573921e3	gst_e2e_success_evidence_0be196c6c4fd4fe08cb963f60d76e2d2	gst_e2e_success_calculation_d80af8cb89c7448eb75f0f4a38046d56	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-SUCCESS	ACCEPTED	E2E	2026-10-31 13:41:41.091	gst_e2e_membership_8c515a3dd23b43a29c97318b841800e1
gst_e2e_decision_3efddc77bb294ba58c86cb5093fa6e89	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_purchase_c8be122a642544c19af214e0c002bc50	gst_e2e_evidence_f02fab1a55b24cdfaa0596365fc2e4eb	gst_e2e_calculation_d5527014235d42f8835919feb24b358b	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-ACCEPT	ACCEPTED	E2E	2026-10-31 13:42:54.027	gst_e2e_membership_9c168e23022c4ea6a91e30bf7f53d51f
gst_e2e_success_decision_3315a174cde74ec49b17838c189a1d25	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_purchase_success_b47ae86c87784e399a738d3dc2c10eac	gst_e2e_success_evidence_f59ac928f5c04c259ad8042882202825	gst_e2e_success_calculation_8b3d4be0f9b342cd8a1ed133ecd75b26	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-SUCCESS	ACCEPTED	E2E	2026-10-31 13:42:54.027	gst_e2e_membership_9c168e23022c4ea6a91e30bf7f53d51f
gst_e2e_decision_e8bdbdacb77143359d3f83759d1cbeff	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_purchase_fe5b41c96be0472e858393a3bc74bb43	gst_e2e_evidence_f054d1ff7680480ea175c8d05e8e4ca2	gst_e2e_calculation_787fa17e6a4d494f8cc1f01af807a37f	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-ACCEPT	ACCEPTED	E2E	2026-10-31 13:44:31.539	gst_e2e_membership_a738e1c7be164a439440d2b9df289c9c
gst_e2e_success_decision_9c45bd35c12048519ac60e5108149b3a	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_purchase_success_f1dc1040426446d1986b7570aedcf581	gst_e2e_success_evidence_45e48c775fdd4e239520f5d4c3ff4d7b	gst_e2e_success_calculation_1232b7196aac41f592c4f42a730f31b3	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	SUPPLIER_DECLARED	E2E-SUCCESS	ACCEPTED	E2E	2026-10-31 13:44:31.539	gst_e2e_membership_a738e1c7be164a439440d2b9df289c9c
\.


--
-- Data for Name: purchase_gst_calculations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_gst_calculations (id, tenant_id, purchase_invoice_id, evidence_revision_id, rule_version, calculated_at, calculation_provenance, input_fingerprint, calculated_taxable_value, calculated_cgst, calculated_sgst, calculated_igst, calculated_cess, calculated_invoice_total, calculated_round_off) FROM stdin;
gst_e2e_calculation_2a152435de974f3189a4c24008ba3cd6	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	gst_e2e_purchase_588bcf74620049639f3d530fe823607c	gst_e2e_evidence_6f9671b769a148328ecced283a8dd951	e2e-v1	2026-10-31 13:29:28.512	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_success_calculation_3f0791e4e1bb4278829899b9cb920478	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	gst_e2e_purchase_success_9f6de0f839f54ce6a06fe3294e289ca0	gst_e2e_success_evidence_67b50dbf0226457fbce26344c53eca6e	e2e-v1	2026-10-31 13:29:28.512	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_review_calculation_1785c6f8afe24dfab56753529f0d4411	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	gst_e2e_purchase_review_5d74ea10d97449689cc7563dc5d5af33	gst_e2e_review_evidence_ed5d54027ca94d858e3256b0cce25a24	e2e-v1	2026-10-31 13:29:28.512	\N	\N	100.0000	10.0000	8.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_calculation_d91d442a17ea413e97a962c40ca7f1a2	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_purchase_f9ced06c11024da6a5119cb2ef66b937	gst_e2e_evidence_429e8f420fc14709ba8c35768402c1ca	e2e-v1	2026-10-31 13:29:43.689	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_success_calculation_a7cb5b355c2446e1903cce1ee684e3a1	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_purchase_success_a07e26b2f62b4c349358b2673fd282eb	gst_e2e_success_evidence_51416e49c9e7421b95597228e97429a6	e2e-v1	2026-10-31 13:29:43.689	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_review_calculation_f6826f85e1a84ee2a5bd92eda29db9c8	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_purchase_review_1c41d3ce0abb4a9c8cee010983d64efc	gst_e2e_review_evidence_5c1f6c0ac2ad42fba56d1670f8d21254	e2e-v1	2026-10-31 13:29:43.689	\N	\N	100.0000	10.0000	8.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_calculation_99ccc487fbec45fbbcb2ccd8f2cd5404	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_purchase_fb99775d866b49c2aafb8081ca4f86eb	gst_e2e_evidence_26fb64cd64364a879e39645c664a9dea	e2e-v1	2026-10-31 13:29:58.518	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_success_calculation_c921a9febdf546a3a4fa75afa8fd1a10	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_purchase_success_9915c8ac103b4eb4a9dbf0867e4d6f4b	gst_e2e_success_evidence_10d40fed778b490b900d1bb0b653cae0	e2e-v1	2026-10-31 13:29:58.518	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_review_calculation_635879df561740648e0ea9cd2b2fd648	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_purchase_review_376c998048ca4ee9b8ed703c72385ef8	gst_e2e_review_evidence_134bd4aa647a47538f53adee573d2631	e2e-v1	2026-10-31 13:29:58.518	\N	\N	100.0000	10.0000	8.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_calculation_a39766b7fbf14160becd89939afbdf2d	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_purchase_e2ca6a2055794c97873b657cbbe3dd88	gst_e2e_evidence_e40a554ef2884ed38e668e06c5d38614	e2e-v1	2026-10-31 13:30:12.558	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_success_calculation_ce972a7046114a36bdd4f289db469f1b	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_purchase_success_df98e2d516d740b59362c02f0a0a568b	gst_e2e_success_evidence_8ea3794385e94ac0ad4a324b4d5ce034	e2e-v1	2026-10-31 13:30:12.558	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_review_calculation_d584aba2da2c4864b8621296ecdc6de7	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_purchase_review_87d7004cd7a24cf4a188af377d8558c5	gst_e2e_review_evidence_2a796a701bda428b9af6b63b36ca69f1	e2e-v1	2026-10-31 13:30:12.558	\N	\N	100.0000	10.0000	8.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_calculation_ce33bcf3b2fc4f2d86945c3f94b82eee	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_purchase_98c3c1dc2f394d6da5829a69d8393314	gst_e2e_evidence_d14fdbed67fe46b2990c0b6b0d1fbabf	e2e-v1	2026-10-31 13:31:24.678	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_success_calculation_f8bda4a0d8b5485ea70ee014462410b8	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_purchase_success_76ea8052134c4255bccb8912dbf8a483	gst_e2e_success_evidence_abf3b283504446cba52e4d2cfdbff12a	e2e-v1	2026-10-31 13:31:24.678	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_review_calculation_6478163aa29d44438b825c5bff0655a4	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_purchase_review_01b1bf72aefe4ac3be448510965e1961	gst_e2e_review_evidence_9faac4401f5c4a17837a63f74839f3b2	e2e-v1	2026-10-31 13:31:24.678	\N	\N	100.0000	10.0000	8.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_calculation_55f82681fe4d4b5899627254870c4a66	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_purchase_e1cd506f35d44abc874f0d767b4c1f9e	gst_e2e_evidence_fe75642589d8499d97173a74492d203c	e2e-v1	2026-10-31 13:32:42.82	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_success_calculation_660568ca7c2d46d186c6dd369a3ecb05	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_purchase_success_2fec4b5f9403413c9f5984a6c80596a7	gst_e2e_success_evidence_e4c32e05982c4a31aaf29dd46b1676d2	e2e-v1	2026-10-31 13:32:42.82	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_review_calculation_d0d3e2aca5c847e499db0ebcd26cf4e3	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_purchase_review_f312556a01fb404da660fdefc608049e	gst_e2e_review_evidence_bfa5d42ef38a4dee9422c2b1703fbd59	e2e-v1	2026-10-31 13:32:42.82	\N	\N	100.0000	10.0000	8.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_calculation_34f8800ed731440d883f225c50a4684e	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_purchase_52aab46bb4c2488598a650643e7f9d5b	gst_e2e_evidence_bbf752e53f6a4ae8a3df3bf2755de704	e2e-v1	2026-10-31 13:33:55.958	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_success_calculation_30bbede44b124b48842d1f6ff37151f1	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_purchase_success_ce69ce80a135405083eb65af66d4e5d2	gst_e2e_success_evidence_8c7e453e8f3d41a1bf9c0e702ab1607a	e2e-v1	2026-10-31 13:33:55.958	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_review_calculation_8ebea172d8cd46e99851aeaec9ec3b9d	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_purchase_review_90ede778497a4aefb088e565488a515a	gst_e2e_review_evidence_2ec953541b5b46888e2a20fb226a0acb	e2e-v1	2026-10-31 13:33:55.958	\N	\N	100.0000	10.0000	8.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_calculation_015e00442f27495e9c8126021064f659	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_purchase_5fd610274c2941c88d5597c4d81883a2	gst_e2e_evidence_60a7666d4cfe4d52892b37363704c0a8	e2e-v1	2026-10-31 13:35:09.31	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_success_calculation_9490e79b1e524ac6839d3212e2d94fd8	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_purchase_success_53face98828d459ea964e6ea9de2adb0	gst_e2e_success_evidence_ba68aa91cac44c6e9929649f15193d6e	e2e-v1	2026-10-31 13:35:09.31	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_review_calculation_5e2b6b911747491294d2087390928915	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_purchase_review_a47a0283ee9640238e7a4e120a1e35f3	gst_e2e_review_evidence_719a4b6dd1d04a4dad46b20d9384832c	e2e-v1	2026-10-31 13:35:09.31	\N	\N	100.0000	10.0000	8.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_calculation_4bf9cc375c644d729e25d7065815816c	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_purchase_3753f502598d4c098c1253bfdbeb1399	gst_e2e_evidence_be3a31ee61eb4bb39f8f74acb22bd228	e2e-v1	2026-10-31 13:36:28.408	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_success_calculation_512f5e04b46844b7a1888226774a787e	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_purchase_success_396c53317f354bc18e427271a7ab8604	gst_e2e_success_evidence_6224d0b13d8a41d3ac60973ed4702998	e2e-v1	2026-10-31 13:36:28.408	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_review_calculation_d38b0e50b4994d6e942066d6bafeb045	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_purchase_review_9bef023ab24842b5ba8de45228c6c2ca	gst_e2e_review_evidence_e5b4618372c841ea90ba2741ab8aadcc	e2e-v1	2026-10-31 13:36:28.408	\N	\N	100.0000	10.0000	8.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_calculation_3e6392ed2c5548818aabc00b95162fd5	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_purchase_aa38f212da914bda918c06dc0dc8adf3	gst_e2e_evidence_7471892240924f08b7230dd222ae676c	e2e-v1	2026-10-31 13:37:50.384	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_success_calculation_c7d3e4a852104d058bb5afeb66c0d57c	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_purchase_success_1f164fb2783447d69f85f7df093931fa	gst_e2e_success_evidence_8b0d0d4e0e354dfaa6cacf8bb5f0796e	e2e-v1	2026-10-31 13:37:50.384	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_review_calculation_0cdf65feebe54f268167529f75835e95	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_purchase_review_0b74f3abdc6348debd09627ac5fce657	gst_e2e_review_evidence_3495581ee622415e9b540931d49ad02b	e2e-v1	2026-10-31 13:37:50.384	\N	\N	100.0000	10.0000	8.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_calculation_0dd6d6dc45d94faebbdd86aff90e60d0	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_purchase_38e1c1314c35421aa667471b779fd8ed	gst_e2e_evidence_9bf2b25253a94cb18716fabf4462c32d	e2e-v1	2026-10-31 13:39:14.029	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_success_calculation_827963418bd54ea6969c49c569e9e62a	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_purchase_success_f29700e5a951456bb04d6db56b016c68	gst_e2e_success_evidence_003b9b9272074716b23b802714bac772	e2e-v1	2026-10-31 13:39:14.029	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_review_calculation_02891cde381647ffa7c569621be9cef9	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_purchase_review_0256831e33e6469b837fd9f821575f21	gst_e2e_review_evidence_2b08574534384d909ef83abf776e8139	e2e-v1	2026-10-31 13:39:14.029	\N	\N	100.0000	10.0000	8.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_calculation_43385fa3b0134e16a271b0485dae43dc	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_purchase_75279e266cd94fa19dcc9ba55b20d90e	gst_e2e_evidence_24845f17dc8c4f41b405d61b219154e7	e2e-v1	2026-10-31 13:40:27.581	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_success_calculation_c9bc969a79304383920ad682cbaaa2c7	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_purchase_success_d51c27ab43b145f195d586fed5ac6f01	gst_e2e_success_evidence_f6ff4a916855451d966f3a0a2e2914a1	e2e-v1	2026-10-31 13:40:27.581	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_review_calculation_d4f1684e4fe74aa8b087fd351bfca0e3	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_purchase_review_893c3e53167b4468ac995d35faf60660	gst_e2e_review_evidence_ce39a492dd844f84bc65e1704cbf846d	e2e-v1	2026-10-31 13:40:27.581	\N	\N	100.0000	10.0000	8.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_calculation_72a6392096d648c58f161d9cbb41b9f7	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_purchase_918bcf5b68ac49f9868815f7667ab03e	gst_e2e_evidence_c077e57256d74049b79ebf881c3bfcb9	e2e-v1	2026-10-31 13:41:41.091	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_success_calculation_d80af8cb89c7448eb75f0f4a38046d56	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_purchase_success_aaefa95e91204a878b000841573921e3	gst_e2e_success_evidence_0be196c6c4fd4fe08cb963f60d76e2d2	e2e-v1	2026-10-31 13:41:41.091	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_review_calculation_26ccc0f7a2bd4afd9b9b996000da021e	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_purchase_review_ce842d07899f4922976aa549b4b05524	gst_e2e_review_evidence_1c35351003034d6ebfaa7154d2b9ed4a	e2e-v1	2026-10-31 13:41:41.091	\N	\N	100.0000	10.0000	8.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_calculation_d5527014235d42f8835919feb24b358b	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_purchase_c8be122a642544c19af214e0c002bc50	gst_e2e_evidence_f02fab1a55b24cdfaa0596365fc2e4eb	e2e-v1	2026-10-31 13:42:54.027	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_success_calculation_8b3d4be0f9b342cd8a1ed133ecd75b26	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_purchase_success_b47ae86c87784e399a738d3dc2c10eac	gst_e2e_success_evidence_f59ac928f5c04c259ad8042882202825	e2e-v1	2026-10-31 13:42:54.027	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_review_calculation_0c8f9f798f6a459dbf5551c208ca8fde	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_purchase_review_7b7228ad313545c9a943eac12755307e	gst_e2e_review_evidence_6606889db16b4cd6bdcad1248dc52ff5	e2e-v1	2026-10-31 13:42:54.027	\N	\N	100.0000	10.0000	8.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_calculation_787fa17e6a4d494f8cc1f01af807a37f	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_purchase_fe5b41c96be0472e858393a3bc74bb43	gst_e2e_evidence_f054d1ff7680480ea175c8d05e8e4ca2	e2e-v1	2026-10-31 13:44:31.539	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_success_calculation_1232b7196aac41f592c4f42a730f31b3	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_purchase_success_f1dc1040426446d1986b7570aedcf581	gst_e2e_success_evidence_45e48c775fdd4e239520f5d4c3ff4d7b	e2e-v1	2026-10-31 13:44:31.539	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000
gst_e2e_review_calculation_faeebae1dc324f70a693bb32c6858bc9	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_purchase_review_0ab7d0b965eb43e5b0540bdcf568a8e8	gst_e2e_review_evidence_e14c264ff83d4a2997528cf1f2dad433	e2e-v1	2026-10-31 13:44:31.539	\N	\N	100.0000	10.0000	8.0000	0.0000	0.0000	118.0000	0.0000
\.


--
-- Data for Name: purchase_gst_evidence_revisions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_gst_evidence_revisions (id, tenant_id, purchase_invoice_id, revision_number, revision_kind, supersedes_revision_id, source_document_reference, capture_channel, capture_provenance, correction_reason, captured_at, captured_by_membership_id, declared_taxable_value_raw, declared_cgst_raw, declared_sgst_raw, declared_igst_raw, declared_cess_raw, declared_invoice_total_raw, declared_round_off_raw, declared_taxable_value, declared_cgst, declared_sgst, declared_igst, declared_cess, declared_invoice_total, declared_round_off, supplier_state_at_transaction, recipient_state_at_transaction, delivery_state_at_transaction, supply_scenario, supply_facts, source_fingerprint) FROM stdin;
gst_e2e_evidence_6f9671b769a148328ecced283a8dd951	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	gst_e2e_purchase_588bcf74620049639f3d530fe823607c	1	INITIAL	\N	E2E-SOURCE-ROLLBACK	E2E	\N	\N	2026-10-31 13:29:28.512	gst_e2e_membership_157ab353bc034261878493cdd101dba3	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_success_evidence_67b50dbf0226457fbce26344c53eca6e	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	gst_e2e_purchase_success_9f6de0f839f54ce6a06fe3294e289ca0	1	INITIAL	\N	E2E-SOURCE-SUCCESS	E2E	\N	\N	2026-10-31 13:29:28.512	gst_e2e_membership_157ab353bc034261878493cdd101dba3	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_review_evidence_ed5d54027ca94d858e3256b0cce25a24	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	gst_e2e_purchase_review_5d74ea10d97449689cc7563dc5d5af33	1	INITIAL	\N	E2E-SOURCE-REVIEW	E2E	\N	\N	2026-10-31 13:29:28.512	gst_e2e_membership_157ab353bc034261878493cdd101dba3	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_evidence_429e8f420fc14709ba8c35768402c1ca	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_purchase_f9ced06c11024da6a5119cb2ef66b937	1	INITIAL	\N	E2E-SOURCE-ROLLBACK	E2E	\N	\N	2026-10-31 13:29:43.689	gst_e2e_membership_cddf1b53e7a84908becdf020da632566	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_success_evidence_51416e49c9e7421b95597228e97429a6	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_purchase_success_a07e26b2f62b4c349358b2673fd282eb	1	INITIAL	\N	E2E-SOURCE-SUCCESS	E2E	\N	\N	2026-10-31 13:29:43.689	gst_e2e_membership_cddf1b53e7a84908becdf020da632566	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_review_evidence_5c1f6c0ac2ad42fba56d1670f8d21254	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_purchase_review_1c41d3ce0abb4a9c8cee010983d64efc	1	INITIAL	\N	E2E-SOURCE-REVIEW	E2E	\N	\N	2026-10-31 13:29:43.689	gst_e2e_membership_cddf1b53e7a84908becdf020da632566	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_evidence_26fb64cd64364a879e39645c664a9dea	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_purchase_fb99775d866b49c2aafb8081ca4f86eb	1	INITIAL	\N	E2E-SOURCE-ROLLBACK	E2E	\N	\N	2026-10-31 13:29:58.518	gst_e2e_membership_a30d0390f1da442d88966edb68bb68fd	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_success_evidence_10d40fed778b490b900d1bb0b653cae0	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_purchase_success_9915c8ac103b4eb4a9dbf0867e4d6f4b	1	INITIAL	\N	E2E-SOURCE-SUCCESS	E2E	\N	\N	2026-10-31 13:29:58.518	gst_e2e_membership_a30d0390f1da442d88966edb68bb68fd	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_review_evidence_134bd4aa647a47538f53adee573d2631	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_purchase_review_376c998048ca4ee9b8ed703c72385ef8	1	INITIAL	\N	E2E-SOURCE-REVIEW	E2E	\N	\N	2026-10-31 13:29:58.518	gst_e2e_membership_a30d0390f1da442d88966edb68bb68fd	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_evidence_e40a554ef2884ed38e668e06c5d38614	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_purchase_e2ca6a2055794c97873b657cbbe3dd88	1	INITIAL	\N	E2E-SOURCE-ROLLBACK	E2E	\N	\N	2026-10-31 13:30:12.558	gst_e2e_membership_dccfb3488bb9441893e2e576cc6fe8b2	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_success_evidence_8ea3794385e94ac0ad4a324b4d5ce034	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_purchase_success_df98e2d516d740b59362c02f0a0a568b	1	INITIAL	\N	E2E-SOURCE-SUCCESS	E2E	\N	\N	2026-10-31 13:30:12.558	gst_e2e_membership_dccfb3488bb9441893e2e576cc6fe8b2	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_review_evidence_2a796a701bda428b9af6b63b36ca69f1	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_purchase_review_87d7004cd7a24cf4a188af377d8558c5	1	INITIAL	\N	E2E-SOURCE-REVIEW	E2E	\N	\N	2026-10-31 13:30:12.558	gst_e2e_membership_dccfb3488bb9441893e2e576cc6fe8b2	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_evidence_d14fdbed67fe46b2990c0b6b0d1fbabf	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_purchase_98c3c1dc2f394d6da5829a69d8393314	1	INITIAL	\N	E2E-SOURCE-ROLLBACK	E2E	\N	\N	2026-10-31 13:31:24.678	gst_e2e_membership_1a2cf1d65db342089313b83dd482d91d	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_success_evidence_abf3b283504446cba52e4d2cfdbff12a	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_purchase_success_76ea8052134c4255bccb8912dbf8a483	1	INITIAL	\N	E2E-SOURCE-SUCCESS	E2E	\N	\N	2026-10-31 13:31:24.678	gst_e2e_membership_1a2cf1d65db342089313b83dd482d91d	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_review_evidence_9faac4401f5c4a17837a63f74839f3b2	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_purchase_review_01b1bf72aefe4ac3be448510965e1961	1	INITIAL	\N	E2E-SOURCE-REVIEW	E2E	\N	\N	2026-10-31 13:31:24.678	gst_e2e_membership_1a2cf1d65db342089313b83dd482d91d	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_evidence_fe75642589d8499d97173a74492d203c	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_purchase_e1cd506f35d44abc874f0d767b4c1f9e	1	INITIAL	\N	E2E-SOURCE-ROLLBACK	E2E	\N	\N	2026-10-31 13:32:42.82	gst_e2e_membership_06a1cb1c6801491eb3e16edde3535f10	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_success_evidence_e4c32e05982c4a31aaf29dd46b1676d2	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_purchase_success_2fec4b5f9403413c9f5984a6c80596a7	1	INITIAL	\N	E2E-SOURCE-SUCCESS	E2E	\N	\N	2026-10-31 13:32:42.82	gst_e2e_membership_06a1cb1c6801491eb3e16edde3535f10	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_review_evidence_bfa5d42ef38a4dee9422c2b1703fbd59	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_purchase_review_f312556a01fb404da660fdefc608049e	1	INITIAL	\N	E2E-SOURCE-REVIEW	E2E	\N	\N	2026-10-31 13:32:42.82	gst_e2e_membership_06a1cb1c6801491eb3e16edde3535f10	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_evidence_bbf752e53f6a4ae8a3df3bf2755de704	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_purchase_52aab46bb4c2488598a650643e7f9d5b	1	INITIAL	\N	E2E-SOURCE-ROLLBACK	E2E	\N	\N	2026-10-31 13:33:55.958	gst_e2e_membership_c8d52f2d9d93451a8259ab0879be66cb	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_success_evidence_8c7e453e8f3d41a1bf9c0e702ab1607a	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_purchase_success_ce69ce80a135405083eb65af66d4e5d2	1	INITIAL	\N	E2E-SOURCE-SUCCESS	E2E	\N	\N	2026-10-31 13:33:55.958	gst_e2e_membership_c8d52f2d9d93451a8259ab0879be66cb	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_review_evidence_2ec953541b5b46888e2a20fb226a0acb	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_purchase_review_90ede778497a4aefb088e565488a515a	1	INITIAL	\N	E2E-SOURCE-REVIEW	E2E	\N	\N	2026-10-31 13:33:55.958	gst_e2e_membership_c8d52f2d9d93451a8259ab0879be66cb	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_evidence_60a7666d4cfe4d52892b37363704c0a8	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_purchase_5fd610274c2941c88d5597c4d81883a2	1	INITIAL	\N	E2E-SOURCE-ROLLBACK	E2E	\N	\N	2026-10-31 13:35:09.31	gst_e2e_membership_21bfedf0ae6947e4829b40618e2cb7ec	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_success_evidence_ba68aa91cac44c6e9929649f15193d6e	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_purchase_success_53face98828d459ea964e6ea9de2adb0	1	INITIAL	\N	E2E-SOURCE-SUCCESS	E2E	\N	\N	2026-10-31 13:35:09.31	gst_e2e_membership_21bfedf0ae6947e4829b40618e2cb7ec	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_review_evidence_719a4b6dd1d04a4dad46b20d9384832c	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_purchase_review_a47a0283ee9640238e7a4e120a1e35f3	1	INITIAL	\N	E2E-SOURCE-REVIEW	E2E	\N	\N	2026-10-31 13:35:09.31	gst_e2e_membership_21bfedf0ae6947e4829b40618e2cb7ec	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_evidence_be3a31ee61eb4bb39f8f74acb22bd228	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_purchase_3753f502598d4c098c1253bfdbeb1399	1	INITIAL	\N	E2E-SOURCE-ROLLBACK	E2E	\N	\N	2026-10-31 13:36:28.408	gst_e2e_membership_4c82e0f9df22462fa68e3b900d05de5c	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_success_evidence_6224d0b13d8a41d3ac60973ed4702998	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_purchase_success_396c53317f354bc18e427271a7ab8604	1	INITIAL	\N	E2E-SOURCE-SUCCESS	E2E	\N	\N	2026-10-31 13:36:28.408	gst_e2e_membership_4c82e0f9df22462fa68e3b900d05de5c	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_review_evidence_e5b4618372c841ea90ba2741ab8aadcc	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_purchase_review_9bef023ab24842b5ba8de45228c6c2ca	1	INITIAL	\N	E2E-SOURCE-REVIEW	E2E	\N	\N	2026-10-31 13:36:28.408	gst_e2e_membership_4c82e0f9df22462fa68e3b900d05de5c	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_evidence_7471892240924f08b7230dd222ae676c	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_purchase_aa38f212da914bda918c06dc0dc8adf3	1	INITIAL	\N	E2E-SOURCE-ROLLBACK	E2E	\N	\N	2026-10-31 13:37:50.384	gst_e2e_membership_1fda0d27d95245bb8d215a787bd6ca7a	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_success_evidence_8b0d0d4e0e354dfaa6cacf8bb5f0796e	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_purchase_success_1f164fb2783447d69f85f7df093931fa	1	INITIAL	\N	E2E-SOURCE-SUCCESS	E2E	\N	\N	2026-10-31 13:37:50.384	gst_e2e_membership_1fda0d27d95245bb8d215a787bd6ca7a	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_review_evidence_3495581ee622415e9b540931d49ad02b	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_purchase_review_0b74f3abdc6348debd09627ac5fce657	1	INITIAL	\N	E2E-SOURCE-REVIEW	E2E	\N	\N	2026-10-31 13:37:50.384	gst_e2e_membership_1fda0d27d95245bb8d215a787bd6ca7a	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_evidence_9bf2b25253a94cb18716fabf4462c32d	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_purchase_38e1c1314c35421aa667471b779fd8ed	1	INITIAL	\N	E2E-SOURCE-ROLLBACK	E2E	\N	\N	2026-10-31 13:39:14.029	gst_e2e_membership_ccb7741181d042c3a7a11a78a50626b2	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_success_evidence_003b9b9272074716b23b802714bac772	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_purchase_success_f29700e5a951456bb04d6db56b016c68	1	INITIAL	\N	E2E-SOURCE-SUCCESS	E2E	\N	\N	2026-10-31 13:39:14.029	gst_e2e_membership_ccb7741181d042c3a7a11a78a50626b2	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_review_evidence_2b08574534384d909ef83abf776e8139	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_purchase_review_0256831e33e6469b837fd9f821575f21	1	INITIAL	\N	E2E-SOURCE-REVIEW	E2E	\N	\N	2026-10-31 13:39:14.029	gst_e2e_membership_ccb7741181d042c3a7a11a78a50626b2	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_evidence_24845f17dc8c4f41b405d61b219154e7	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_purchase_75279e266cd94fa19dcc9ba55b20d90e	1	INITIAL	\N	E2E-SOURCE-ROLLBACK	E2E	\N	\N	2026-10-31 13:40:27.581	gst_e2e_membership_5c263d013fa34469870be8eca0547662	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_success_evidence_f6ff4a916855451d966f3a0a2e2914a1	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_purchase_success_d51c27ab43b145f195d586fed5ac6f01	1	INITIAL	\N	E2E-SOURCE-SUCCESS	E2E	\N	\N	2026-10-31 13:40:27.581	gst_e2e_membership_5c263d013fa34469870be8eca0547662	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_review_evidence_ce39a492dd844f84bc65e1704cbf846d	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_purchase_review_893c3e53167b4468ac995d35faf60660	1	INITIAL	\N	E2E-SOURCE-REVIEW	E2E	\N	\N	2026-10-31 13:40:27.581	gst_e2e_membership_5c263d013fa34469870be8eca0547662	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_evidence_c077e57256d74049b79ebf881c3bfcb9	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_purchase_918bcf5b68ac49f9868815f7667ab03e	1	INITIAL	\N	E2E-SOURCE-ROLLBACK	E2E	\N	\N	2026-10-31 13:41:41.091	gst_e2e_membership_8c515a3dd23b43a29c97318b841800e1	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_success_evidence_0be196c6c4fd4fe08cb963f60d76e2d2	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_purchase_success_aaefa95e91204a878b000841573921e3	1	INITIAL	\N	E2E-SOURCE-SUCCESS	E2E	\N	\N	2026-10-31 13:41:41.091	gst_e2e_membership_8c515a3dd23b43a29c97318b841800e1	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_review_evidence_1c35351003034d6ebfaa7154d2b9ed4a	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_purchase_review_ce842d07899f4922976aa549b4b05524	1	INITIAL	\N	E2E-SOURCE-REVIEW	E2E	\N	\N	2026-10-31 13:41:41.091	gst_e2e_membership_8c515a3dd23b43a29c97318b841800e1	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_evidence_f02fab1a55b24cdfaa0596365fc2e4eb	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_purchase_c8be122a642544c19af214e0c002bc50	1	INITIAL	\N	E2E-SOURCE-ROLLBACK	E2E	\N	\N	2026-10-31 13:42:54.027	gst_e2e_membership_9c168e23022c4ea6a91e30bf7f53d51f	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_success_evidence_f59ac928f5c04c259ad8042882202825	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_purchase_success_b47ae86c87784e399a738d3dc2c10eac	1	INITIAL	\N	E2E-SOURCE-SUCCESS	E2E	\N	\N	2026-10-31 13:42:54.027	gst_e2e_membership_9c168e23022c4ea6a91e30bf7f53d51f	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_review_evidence_6606889db16b4cd6bdcad1248dc52ff5	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_purchase_review_7b7228ad313545c9a943eac12755307e	1	INITIAL	\N	E2E-SOURCE-REVIEW	E2E	\N	\N	2026-10-31 13:42:54.027	gst_e2e_membership_9c168e23022c4ea6a91e30bf7f53d51f	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_evidence_f054d1ff7680480ea175c8d05e8e4ca2	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_purchase_fe5b41c96be0472e858393a3bc74bb43	1	INITIAL	\N	E2E-SOURCE-ROLLBACK	E2E	\N	\N	2026-10-31 13:44:31.539	gst_e2e_membership_a738e1c7be164a439440d2b9df289c9c	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_success_evidence_45e48c775fdd4e239520f5d4c3ff4d7b	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_purchase_success_f1dc1040426446d1986b7570aedcf581	1	INITIAL	\N	E2E-SOURCE-SUCCESS	E2E	\N	\N	2026-10-31 13:44:31.539	gst_e2e_membership_a738e1c7be164a439440d2b9df289c9c	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
gst_e2e_review_evidence_e14c264ff83d4a2997528cf1f2dad433	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_purchase_review_0ab7d0b965eb43e5b0540bdcf568a8e8	1	INITIAL	\N	E2E-SOURCE-REVIEW	E2E	\N	\N	2026-10-31 13:44:31.539	gst_e2e_membership_a738e1c7be164a439440d2b9df289c9c	\N	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000	0.0000	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: purchase_gst_line_evidence; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_gst_line_evidence (id, tenant_id, purchase_invoice_id, evidence_revision_id, purchase_invoice_item_id, declared_taxable_value_raw, declared_cgst_raw, declared_sgst_raw, declared_igst_raw, declared_cess_raw, declared_line_total_raw, declared_taxable_value, declared_cgst, declared_sgst, declared_igst, declared_cess, declared_line_total) FROM stdin;
gst_e2e_success_line_evidence_891879aa8ec44d759385c1c85e14f2f4	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	gst_e2e_purchase_success_9f6de0f839f54ce6a06fe3294e289ca0	gst_e2e_success_evidence_67b50dbf0226457fbce26344c53eca6e	gst_e2e_purchase_success_item_272d7c2268474ccf8b548511df6134dc	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000
gst_e2e_success_line_evidence_71acb2469fbf4609a732528581ae32af	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_purchase_success_a07e26b2f62b4c349358b2673fd282eb	gst_e2e_success_evidence_51416e49c9e7421b95597228e97429a6	gst_e2e_purchase_success_item_ce105483285848569d081dc56fcebc2f	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000
gst_e2e_success_line_evidence_c9fbafc4acf644c69d7227deeeea3b64	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_purchase_success_9915c8ac103b4eb4a9dbf0867e4d6f4b	gst_e2e_success_evidence_10d40fed778b490b900d1bb0b653cae0	gst_e2e_purchase_success_item_3cfc28e66adb44f886a2b89d17700b27	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000
gst_e2e_success_line_evidence_b9c7b043bf1c481c9d036dfff61221cf	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_purchase_success_df98e2d516d740b59362c02f0a0a568b	gst_e2e_success_evidence_8ea3794385e94ac0ad4a324b4d5ce034	gst_e2e_purchase_success_item_e42b889566ce459a9c43924dae8092aa	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000
gst_e2e_success_line_evidence_f82519f4668a4178b4561a287b421e76	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_purchase_success_76ea8052134c4255bccb8912dbf8a483	gst_e2e_success_evidence_abf3b283504446cba52e4d2cfdbff12a	gst_e2e_purchase_success_item_b932d4d96f8d43708e8aa983b49a4e2d	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000
gst_e2e_success_line_evidence_76bd1836f36346da846068600c09a1b1	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_purchase_success_2fec4b5f9403413c9f5984a6c80596a7	gst_e2e_success_evidence_e4c32e05982c4a31aaf29dd46b1676d2	gst_e2e_purchase_success_item_4b71c6cb384149a8ae5694783ada217a	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000
gst_e2e_success_line_evidence_3093caa461f04bae95344f6db5517032	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_purchase_success_ce69ce80a135405083eb65af66d4e5d2	gst_e2e_success_evidence_8c7e453e8f3d41a1bf9c0e702ab1607a	gst_e2e_purchase_success_item_75aac6a985e64811afce4cbaf4722499	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000
gst_e2e_success_line_evidence_dd487b3031ff4c20a3ba880362abe23b	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_purchase_success_53face98828d459ea964e6ea9de2adb0	gst_e2e_success_evidence_ba68aa91cac44c6e9929649f15193d6e	gst_e2e_purchase_success_item_4f26e0dc02e542f2ac9d6f35bba8cf8f	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000
gst_e2e_success_line_evidence_ee71253c116840368ef501e73649965c	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_purchase_success_396c53317f354bc18e427271a7ab8604	gst_e2e_success_evidence_6224d0b13d8a41d3ac60973ed4702998	gst_e2e_purchase_success_item_7c29e1d6c8ef4f4d9061cc77edf30514	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000
gst_e2e_success_line_evidence_9a7a437cc8454fac8e15914d7b5306a0	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_purchase_success_1f164fb2783447d69f85f7df093931fa	gst_e2e_success_evidence_8b0d0d4e0e354dfaa6cacf8bb5f0796e	gst_e2e_purchase_success_item_581749bc12cc4226b714ee7addbd4d0d	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000
gst_e2e_success_line_evidence_7dc27cd1ff024f81b6f05736aeaca793	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_purchase_success_f29700e5a951456bb04d6db56b016c68	gst_e2e_success_evidence_003b9b9272074716b23b802714bac772	gst_e2e_purchase_success_item_ca92266ff810470288f49aaf9e9c7ee0	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000
gst_e2e_success_line_evidence_03b215d0c2d547fe9eacb551d1f39e77	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_purchase_success_d51c27ab43b145f195d586fed5ac6f01	gst_e2e_success_evidence_f6ff4a916855451d966f3a0a2e2914a1	gst_e2e_purchase_success_item_9a8a9770d97f47ab84980c7a827f24ca	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000
gst_e2e_success_line_evidence_1e43d7a8bdaa4cabac622a0f2274ac3d	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_purchase_success_aaefa95e91204a878b000841573921e3	gst_e2e_success_evidence_0be196c6c4fd4fe08cb963f60d76e2d2	gst_e2e_purchase_success_item_f9b2faed717a430780d34d6859f245fc	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000
gst_e2e_success_line_evidence_f67f17ddd3124024b184a79f5beb3087	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_purchase_success_b47ae86c87784e399a738d3dc2c10eac	gst_e2e_success_evidence_f59ac928f5c04c259ad8042882202825	gst_e2e_purchase_success_item_ae3cb5bbc738456ab0ab13de5493d200	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000
gst_e2e_success_line_evidence_f8b0d02f3a5e41e0a4528733bce5fa9e	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_purchase_success_f1dc1040426446d1986b7570aedcf581	gst_e2e_success_evidence_45e48c775fdd4e239520f5d4c3ff4d7b	gst_e2e_purchase_success_item_c8019a3b98e045d6984ca8421e61dcae	\N	\N	\N	\N	\N	\N	100.0000	9.0000	9.0000	0.0000	0.0000	118.0000
\.


--
-- Data for Name: purchase_gst_reconciliation_event_lines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_gst_reconciliation_event_lines (id, tenant_id, purchase_invoice_id, evidence_revision_id, event_id, line_evidence_id) FROM stdin;
\.


--
-- Data for Name: purchase_gst_reconciliation_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_gst_reconciliation_events (id, tenant_id, purchase_invoice_id, evidence_revision_id, event_kind, from_status, to_status, operation, idempotency_key, request_payload_hash, decision_reference, rule_version, actor_membership_id, declared_snapshot, calculated_snapshot, accepted_snapshot, discrepancy_details, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: purchase_invoice_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_invoice_items (id, tenant_id, purchase_id, product_id, batch_no, expiry_date, quantity, free_qty, purchase_rate, discount_pct, discount_amount, gst_rate, gst_amount, mrp, sale_rate, line_total, created_at, hsn_code_snapshot, calculated_taxable_value, calculated_cgst, calculated_sgst, calculated_igst, calculated_cess, accepted_taxable_value, accepted_cgst, accepted_sgst, accepted_igst, accepted_cess, gst_acceptance_status, gst_discrepancy_details, gst_calculation_reference, gst_acceptance_reference) FROM stdin;
gst_e2e_purchase_item_a0e6cd2f04a2423f82df2b31bf8686ca	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	gst_e2e_purchase_588bcf74620049639f3d530fe823607c	gst_e2e_product_a_0e5f741a296b4af6ad4cf0270cd49f27	P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:29:28.512	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_success_item_272d7c2268474ccf8b548511df6134dc	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	gst_e2e_purchase_success_9f6de0f839f54ce6a06fe3294e289ca0	gst_e2e_product_a_0e5f741a296b4af6ad4cf0270cd49f27	SUCCESS-P-1	\N	2	0	50.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:29:28.512	3004	100.0000	9.0000	9.0000	0.0000	0.0000	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	e2e-v1	\N
gst_e2e_purchase_review_item_3086375193f24aadbcd4434f15f86e52	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	gst_e2e_purchase_review_5d74ea10d97449689cc7563dc5d5af33	gst_e2e_product_a_0e5f741a296b4af6ad4cf0270cd49f27	REVIEW-P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:29:28.512	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_item_c316f96a00524d6d80a46c729b8b1ca8	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_purchase_f9ced06c11024da6a5119cb2ef66b937	gst_e2e_product_a_dd647e0a44a04492b3ae5c7424277e1e	P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:29:43.689	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_success_item_ce105483285848569d081dc56fcebc2f	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_purchase_success_a07e26b2f62b4c349358b2673fd282eb	gst_e2e_product_a_dd647e0a44a04492b3ae5c7424277e1e	SUCCESS-P-1	\N	2	0	50.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:29:43.689	3004	100.0000	9.0000	9.0000	0.0000	0.0000	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	e2e-v1	\N
gst_e2e_purchase_review_item_a844eac11d804bbeb83f4d766af3f6b8	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_purchase_review_1c41d3ce0abb4a9c8cee010983d64efc	gst_e2e_product_a_dd647e0a44a04492b3ae5c7424277e1e	REVIEW-P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:29:43.689	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_item_abefb2ee3c44410d8f729fdc31035538	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_purchase_fb99775d866b49c2aafb8081ca4f86eb	gst_e2e_product_a_98176164cbb747ef893682f89e6ec2a2	P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:29:58.518	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_success_item_3cfc28e66adb44f886a2b89d17700b27	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_purchase_success_9915c8ac103b4eb4a9dbf0867e4d6f4b	gst_e2e_product_a_98176164cbb747ef893682f89e6ec2a2	SUCCESS-P-1	\N	2	0	50.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:29:58.518	3004	100.0000	9.0000	9.0000	0.0000	0.0000	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	e2e-v1	\N
gst_e2e_purchase_review_item_9243791844404fac9295ed7c9e5199fe	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_purchase_review_376c998048ca4ee9b8ed703c72385ef8	gst_e2e_product_a_98176164cbb747ef893682f89e6ec2a2	REVIEW-P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:29:58.518	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_item_4494f07636514971a8f3262511467634	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_purchase_e2ca6a2055794c97873b657cbbe3dd88	gst_e2e_product_a_85c96a47ac014220a91e997e63caf697	P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:30:12.558	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_success_item_e42b889566ce459a9c43924dae8092aa	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_purchase_success_df98e2d516d740b59362c02f0a0a568b	gst_e2e_product_a_85c96a47ac014220a91e997e63caf697	SUCCESS-P-1	\N	2	0	50.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:30:12.558	3004	100.0000	9.0000	9.0000	0.0000	0.0000	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	e2e-v1	\N
gst_e2e_purchase_review_item_2d3d746e39524b4da1f8d19c39db0aaa	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_purchase_review_87d7004cd7a24cf4a188af377d8558c5	gst_e2e_product_a_85c96a47ac014220a91e997e63caf697	REVIEW-P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:30:12.558	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_item_491487529e9c44ffb0fe9767395df609	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_purchase_98c3c1dc2f394d6da5829a69d8393314	gst_e2e_product_a_7b2e376947094939a8ff8015cc8f64f0	P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:31:24.678	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_success_item_b932d4d96f8d43708e8aa983b49a4e2d	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_purchase_success_76ea8052134c4255bccb8912dbf8a483	gst_e2e_product_a_7b2e376947094939a8ff8015cc8f64f0	SUCCESS-P-1	\N	2	0	50.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:31:24.678	3004	100.0000	9.0000	9.0000	0.0000	0.0000	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	e2e-v1	\N
gst_e2e_purchase_review_item_1e64db9faffa457484bf02f6b0100cdb	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_purchase_review_01b1bf72aefe4ac3be448510965e1961	gst_e2e_product_a_7b2e376947094939a8ff8015cc8f64f0	REVIEW-P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:31:24.678	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_item_3f30af06b2d0488ebaeef6ac2885e92d	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_purchase_e1cd506f35d44abc874f0d767b4c1f9e	gst_e2e_product_a_1734ed203ca1435e8582715750964b0d	P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:32:42.82	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_success_item_4b71c6cb384149a8ae5694783ada217a	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_purchase_success_2fec4b5f9403413c9f5984a6c80596a7	gst_e2e_product_a_1734ed203ca1435e8582715750964b0d	SUCCESS-P-1	\N	2	0	50.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:32:42.82	3004	100.0000	9.0000	9.0000	0.0000	0.0000	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	e2e-v1	\N
gst_e2e_purchase_review_item_b1c80fda41ae4fd3915095d6bee2272f	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_purchase_review_f312556a01fb404da660fdefc608049e	gst_e2e_product_a_1734ed203ca1435e8582715750964b0d	REVIEW-P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:32:42.82	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_item_91175e68f0b44aa299017430e41fcfe2	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_purchase_52aab46bb4c2488598a650643e7f9d5b	gst_e2e_product_a_fdf4a40153c5437a9ecb579368dedc61	P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:33:55.958	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_success_item_75aac6a985e64811afce4cbaf4722499	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_purchase_success_ce69ce80a135405083eb65af66d4e5d2	gst_e2e_product_a_fdf4a40153c5437a9ecb579368dedc61	SUCCESS-P-1	\N	2	0	50.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:33:55.958	3004	100.0000	9.0000	9.0000	0.0000	0.0000	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	e2e-v1	\N
gst_e2e_purchase_review_item_f521fa2c8cb14457bb7a3d45ff296409	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_purchase_review_90ede778497a4aefb088e565488a515a	gst_e2e_product_a_fdf4a40153c5437a9ecb579368dedc61	REVIEW-P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:33:55.958	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_item_dc22d8711e6a432d975015162f3d69ad	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_purchase_5fd610274c2941c88d5597c4d81883a2	gst_e2e_product_a_30bbee97d538445f8ca1dcf448323e54	P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:35:09.31	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_success_item_4f26e0dc02e542f2ac9d6f35bba8cf8f	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_purchase_success_53face98828d459ea964e6ea9de2adb0	gst_e2e_product_a_30bbee97d538445f8ca1dcf448323e54	SUCCESS-P-1	\N	2	0	50.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:35:09.31	3004	100.0000	9.0000	9.0000	0.0000	0.0000	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	e2e-v1	\N
gst_e2e_purchase_review_item_084a4540902c465e8410a9179192b64c	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_purchase_review_a47a0283ee9640238e7a4e120a1e35f3	gst_e2e_product_a_30bbee97d538445f8ca1dcf448323e54	REVIEW-P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:35:09.31	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_item_f90292d58ab3429a9976bf271482ef06	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_purchase_3753f502598d4c098c1253bfdbeb1399	gst_e2e_product_a_85f2971d05db4af59a4e72f1bcd81079	P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:36:28.408	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_success_item_7c29e1d6c8ef4f4d9061cc77edf30514	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_purchase_success_396c53317f354bc18e427271a7ab8604	gst_e2e_product_a_85f2971d05db4af59a4e72f1bcd81079	SUCCESS-P-1	\N	2	0	50.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:36:28.408	3004	100.0000	9.0000	9.0000	0.0000	0.0000	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	e2e-v1	\N
gst_e2e_purchase_review_item_698a60b1adf946dd950f940e58a9e090	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_purchase_review_9bef023ab24842b5ba8de45228c6c2ca	gst_e2e_product_a_85f2971d05db4af59a4e72f1bcd81079	REVIEW-P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:36:28.408	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_item_7ee525fe87044824ac07cac57a2d1657	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_purchase_aa38f212da914bda918c06dc0dc8adf3	gst_e2e_product_a_799cb53d442f4628a904adc8b69291aa	P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:37:50.384	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_success_item_581749bc12cc4226b714ee7addbd4d0d	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_purchase_success_1f164fb2783447d69f85f7df093931fa	gst_e2e_product_a_799cb53d442f4628a904adc8b69291aa	SUCCESS-P-1	\N	2	0	50.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:37:50.384	3004	100.0000	9.0000	9.0000	0.0000	0.0000	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	e2e-v1	\N
gst_e2e_purchase_review_item_d0c67d5abe0b4c5387bf0d75ccaadca9	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_purchase_review_0b74f3abdc6348debd09627ac5fce657	gst_e2e_product_a_799cb53d442f4628a904adc8b69291aa	REVIEW-P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:37:50.384	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_item_9235e242b8bf44dc9b6228cda8676f6e	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_purchase_38e1c1314c35421aa667471b779fd8ed	gst_e2e_product_a_7473b483cbdd42bb9b764d186206acd7	P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:39:14.029	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_review_item_608f40bfa21245d790167d3ba4d9485b	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_purchase_review_0256831e33e6469b837fd9f821575f21	gst_e2e_product_a_7473b483cbdd42bb9b764d186206acd7	REVIEW-P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:39:14.029	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_success_item_ca92266ff810470288f49aaf9e9c7ee0	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_purchase_success_f29700e5a951456bb04d6db56b016c68	gst_e2e_product_a_7473b483cbdd42bb9b764d186206acd7	SUCCESS-P-1	\N	2	0	50.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:39:14.029	3004	100.0000	9.0000	9.0000	0.0000	0.0000	100.0000	9.0000	9.0000	0.0000	0.0000	ACCEPTED	\N	e2e-v1	E2E-SUCCESS
gst_e2e_purchase_item_cb3766f01f254f0e948a2111605d503c	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_purchase_75279e266cd94fa19dcc9ba55b20d90e	gst_e2e_product_a_ae05cfb72eaa42aabcc0996a8359d276	P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:40:27.581	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_review_item_771eca22c2964dd488b68be06adff407	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_purchase_review_893c3e53167b4468ac995d35faf60660	gst_e2e_product_a_ae05cfb72eaa42aabcc0996a8359d276	REVIEW-P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:40:27.581	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_success_item_9a8a9770d97f47ab84980c7a827f24ca	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_purchase_success_d51c27ab43b145f195d586fed5ac6f01	gst_e2e_product_a_ae05cfb72eaa42aabcc0996a8359d276	SUCCESS-P-1	\N	2	0	50.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:40:27.581	3004	100.0000	9.0000	9.0000	0.0000	0.0000	100.0000	9.0000	9.0000	0.0000	0.0000	ACCEPTED	\N	e2e-v1	E2E-SUCCESS
gst_e2e_purchase_item_55938a57ad1a42db978187f86d48e184	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_purchase_918bcf5b68ac49f9868815f7667ab03e	gst_e2e_product_a_c5b641f60f2b47f78bedf11520bf4bf8	P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:41:41.091	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_review_item_95f81ca350414260bac58343891f25d3	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_purchase_review_ce842d07899f4922976aa549b4b05524	gst_e2e_product_a_c5b641f60f2b47f78bedf11520bf4bf8	REVIEW-P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:41:41.091	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_success_item_f9b2faed717a430780d34d6859f245fc	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_purchase_success_aaefa95e91204a878b000841573921e3	gst_e2e_product_a_c5b641f60f2b47f78bedf11520bf4bf8	SUCCESS-P-1	\N	2	0	50.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:41:41.091	3004	100.0000	9.0000	9.0000	0.0000	0.0000	100.0000	9.0000	9.0000	0.0000	0.0000	ACCEPTED	\N	e2e-v1	E2E-SUCCESS
gst_e2e_purchase_item_2307824cdb10409c86b399522a27e68b	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_purchase_c8be122a642544c19af214e0c002bc50	gst_e2e_product_a_90580835eb21424b947a18e5b7a00cf0	P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:42:54.027	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_review_item_9af449c2f4b9499fbb3684361c4720de	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_purchase_review_7b7228ad313545c9a943eac12755307e	gst_e2e_product_a_90580835eb21424b947a18e5b7a00cf0	REVIEW-P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:42:54.027	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_success_item_ae3cb5bbc738456ab0ab13de5493d200	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_purchase_success_b47ae86c87784e399a738d3dc2c10eac	gst_e2e_product_a_90580835eb21424b947a18e5b7a00cf0	SUCCESS-P-1	\N	2	0	50.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:42:54.027	3004	100.0000	9.0000	9.0000	0.0000	0.0000	100.0000	9.0000	9.0000	0.0000	0.0000	ACCEPTED	\N	e2e-v1	E2E-SUCCESS
gst_e2e_purchase_item_feead699808d4b77992d08d5a1401812	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_purchase_fe5b41c96be0472e858393a3bc74bb43	gst_e2e_product_a_f2815984af604069a7e49a67c2a505ec	P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:44:31.539	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_review_item_2a85e9e1daf54d499193ec88244fce0f	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_purchase_review_0ab7d0b965eb43e5b0540bdcf568a8e8	gst_e2e_product_a_f2815984af604069a7e49a67c2a505ec	REVIEW-P-1	\N	1	0	100.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:44:31.539	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	NOT_ACCEPTED	\N	\N	\N
gst_e2e_purchase_success_item_c8019a3b98e045d6984ca8421e61dcae	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_purchase_success_f1dc1040426446d1986b7570aedcf581	gst_e2e_product_a_f2815984af604069a7e49a67c2a505ec	SUCCESS-P-1	\N	2	0	50.00	\N	0.00	18.00	18.00	\N	\N	118.00	2026-10-31 13:44:31.539	3004	100.0000	9.0000	9.0000	0.0000	0.0000	100.0000	9.0000	9.0000	0.0000	0.0000	ACCEPTED	\N	e2e-v1	E2E-SUCCESS
\.


--
-- Data for Name: purchase_invoices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_invoices (id, tenant_id, invoice_no, supplier_id, supplier_invoice_no, invoice_date, status, gst_reconciliation_status, gst_accounting_acceptance_status, current_gst_evidence_revision_id, current_gst_calculation_id, current_gst_accounting_decision_id, gst_record_version, gross_amount, total_discount, total_tax, round_off, net_amount, notes, created_by, finalized_at, cancelled_at, cancelled_by, created_at, updated_at) FROM stdin;
gst_e2e_purchase_conflict_589b3f57e3d648a7ac5d8abde0e44d91	gst_e2e_tenant_19035406820a497699286f211ca126f6	PUR-00071	gst_e2e_supplier_8b18212293a643b286fb03dcaf60f778	CONFLICT	2026-10-31 13:40:27.581	DRAFT	NOT_RECONCILED	NOT_ACCEPTED	\N	\N	\N	0	100.00	0.00	0.00	0.00	100.00	\N	\N	\N	\N	\N	2026-10-31 13:40:27.581	2026-10-31 13:40:27.581
gst_e2e_purchase_conflict_24d57cebb8ed4a2d9d0450e7402b71de	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	PUR-00071	gst_e2e_supplier_95f394ea1bac4ccdb78d5e9420e43f5d	CONFLICT	2026-10-31 13:29:28.512	DRAFT	NOT_RECONCILED	NOT_ACCEPTED	\N	\N	\N	0	100.00	0.00	0.00	0.00	100.00	\N	\N	\N	\N	\N	2026-10-31 13:29:28.512	2026-10-31 13:29:28.512
gst_e2e_purchase_588bcf74620049639f3d530fe823607c	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9		gst_e2e_supplier_95f394ea1bac4ccdb78d5e9420e43f5d	\N	2026-10-31 13:29:28.512	DRAFT	MATCHED	ACCEPTED	gst_e2e_evidence_6f9671b769a148328ecced283a8dd951	gst_e2e_calculation_2a152435de974f3189a4c24008ba3cd6	gst_e2e_decision_ec088e1271964e72b141d740f8089816	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:29:28.512	2026-10-31 13:29:28.512
gst_e2e_purchase_success_9f6de0f839f54ce6a06fe3294e289ca0	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	DRAFT-4e289ca0	gst_e2e_supplier_95f394ea1bac4ccdb78d5e9420e43f5d	SUCCESS-4e289ca0	2026-10-31 13:29:28.512	DRAFT	MATCHED	ACCEPTED	gst_e2e_success_evidence_67b50dbf0226457fbce26344c53eca6e	gst_e2e_success_calculation_3f0791e4e1bb4278829899b9cb920478	gst_e2e_success_decision_4253f209222142fba7c7f3e9dfe25209	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:29:28.512	2026-10-31 13:29:28.512
gst_e2e_purchase_review_5d74ea10d97449689cc7563dc5d5af33	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	DRAFT-c5d5af33	gst_e2e_supplier_95f394ea1bac4ccdb78d5e9420e43f5d	REVIEW-c5d5af33	2026-10-31 13:29:28.512	DRAFT	DISCREPANCY_REQUIRES_REVIEW	NOT_ACCEPTED	gst_e2e_review_evidence_ed5d54027ca94d858e3256b0cce25a24	gst_e2e_review_calculation_1785c6f8afe24dfab56753529f0d4411	\N	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:29:28.512	2026-10-31 13:29:28.512
gst_e2e_purchase_conflict_b323ec4da45c4cd2840e436b1897549a	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	PUR-00071	gst_e2e_supplier_3ac4112e2faa4f56adc01cd6c482b6b1	CONFLICT	2026-10-31 13:29:43.689	DRAFT	NOT_RECONCILED	NOT_ACCEPTED	\N	\N	\N	0	100.00	0.00	0.00	0.00	100.00	\N	\N	\N	\N	\N	2026-10-31 13:29:43.689	2026-10-31 13:29:43.689
gst_e2e_purchase_f9ced06c11024da6a5119cb2ef66b937	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102		gst_e2e_supplier_3ac4112e2faa4f56adc01cd6c482b6b1	\N	2026-10-31 13:29:43.689	DRAFT	MATCHED	ACCEPTED	gst_e2e_evidence_429e8f420fc14709ba8c35768402c1ca	gst_e2e_calculation_d91d442a17ea413e97a962c40ca7f1a2	gst_e2e_decision_ee377380750d485b9aff1269283a8e52	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:29:43.689	2026-10-31 13:29:43.689
gst_e2e_purchase_success_a07e26b2f62b4c349358b2673fd282eb	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	DRAFT-3fd282eb	gst_e2e_supplier_3ac4112e2faa4f56adc01cd6c482b6b1	SUCCESS-3fd282eb	2026-10-31 13:29:43.689	DRAFT	MATCHED	ACCEPTED	gst_e2e_success_evidence_51416e49c9e7421b95597228e97429a6	gst_e2e_success_calculation_a7cb5b355c2446e1903cce1ee684e3a1	gst_e2e_success_decision_6ffb726de56b4ff391a821e02cecc434	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:29:43.689	2026-10-31 13:29:43.689
gst_e2e_purchase_review_1c41d3ce0abb4a9c8cee010983d64efc	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	DRAFT-83d64efc	gst_e2e_supplier_3ac4112e2faa4f56adc01cd6c482b6b1	REVIEW-83d64efc	2026-10-31 13:29:43.689	DRAFT	DISCREPANCY_REQUIRES_REVIEW	NOT_ACCEPTED	gst_e2e_review_evidence_5c1f6c0ac2ad42fba56d1670f8d21254	gst_e2e_review_calculation_f6826f85e1a84ee2a5bd92eda29db9c8	\N	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:29:43.689	2026-10-31 13:29:43.689
gst_e2e_purchase_conflict_eacf001762ad4e688c77040083734b71	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	PUR-00071	gst_e2e_supplier_088d1fccef84435daa6267d89a4dbaf4	CONFLICT	2026-10-31 13:29:58.518	DRAFT	NOT_RECONCILED	NOT_ACCEPTED	\N	\N	\N	0	100.00	0.00	0.00	0.00	100.00	\N	\N	\N	\N	\N	2026-10-31 13:29:58.518	2026-10-31 13:29:58.518
gst_e2e_purchase_fb99775d866b49c2aafb8081ca4f86eb	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927		gst_e2e_supplier_088d1fccef84435daa6267d89a4dbaf4	\N	2026-10-31 13:29:58.518	DRAFT	MATCHED	ACCEPTED	gst_e2e_evidence_26fb64cd64364a879e39645c664a9dea	gst_e2e_calculation_99ccc487fbec45fbbcb2ccd8f2cd5404	gst_e2e_decision_a8d6804f3d684de0a1a2106803b8191e	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:29:58.518	2026-10-31 13:29:58.518
gst_e2e_purchase_success_9915c8ac103b4eb4a9dbf0867e4d6f4b	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	DRAFT-7e4d6f4b	gst_e2e_supplier_088d1fccef84435daa6267d89a4dbaf4	SUCCESS-7e4d6f4b	2026-10-31 13:29:58.518	DRAFT	MATCHED	ACCEPTED	gst_e2e_success_evidence_10d40fed778b490b900d1bb0b653cae0	gst_e2e_success_calculation_c921a9febdf546a3a4fa75afa8fd1a10	gst_e2e_success_decision_9daf14dbcbbb4aa0b49db4de2479eedc	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:29:58.518	2026-10-31 13:29:58.518
gst_e2e_purchase_review_376c998048ca4ee9b8ed703c72385ef8	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	DRAFT-72385ef8	gst_e2e_supplier_088d1fccef84435daa6267d89a4dbaf4	REVIEW-72385ef8	2026-10-31 13:29:58.518	DRAFT	DISCREPANCY_REQUIRES_REVIEW	NOT_ACCEPTED	gst_e2e_review_evidence_134bd4aa647a47538f53adee573d2631	gst_e2e_review_calculation_635879df561740648e0ea9cd2b2fd648	\N	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:29:58.518	2026-10-31 13:29:58.518
gst_e2e_purchase_conflict_d80abd7057714eae9ba28de0e59fc27c	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	PUR-00071	gst_e2e_supplier_29238b0c2adb4a5aa1fd78d4f9000fbe	CONFLICT	2026-10-31 13:30:12.558	DRAFT	NOT_RECONCILED	NOT_ACCEPTED	\N	\N	\N	0	100.00	0.00	0.00	0.00	100.00	\N	\N	\N	\N	\N	2026-10-31 13:30:12.558	2026-10-31 13:30:12.558
gst_e2e_purchase_e2ca6a2055794c97873b657cbbe3dd88	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19		gst_e2e_supplier_29238b0c2adb4a5aa1fd78d4f9000fbe	\N	2026-10-31 13:30:12.558	DRAFT	MATCHED	ACCEPTED	gst_e2e_evidence_e40a554ef2884ed38e668e06c5d38614	gst_e2e_calculation_a39766b7fbf14160becd89939afbdf2d	gst_e2e_decision_ec6eed22843343ea8e9e62b296ee7bca	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:30:12.558	2026-10-31 13:30:12.558
gst_e2e_purchase_success_df98e2d516d740b59362c02f0a0a568b	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	DRAFT-0a0a568b	gst_e2e_supplier_29238b0c2adb4a5aa1fd78d4f9000fbe	SUCCESS-0a0a568b	2026-10-31 13:30:12.558	DRAFT	MATCHED	ACCEPTED	gst_e2e_success_evidence_8ea3794385e94ac0ad4a324b4d5ce034	gst_e2e_success_calculation_ce972a7046114a36bdd4f289db469f1b	gst_e2e_success_decision_6e84fa800bb142c18b99a6c957f214d0	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:30:12.558	2026-10-31 13:30:12.558
gst_e2e_purchase_review_87d7004cd7a24cf4a188af377d8558c5	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	DRAFT-7d8558c5	gst_e2e_supplier_29238b0c2adb4a5aa1fd78d4f9000fbe	REVIEW-7d8558c5	2026-10-31 13:30:12.558	DRAFT	DISCREPANCY_REQUIRES_REVIEW	NOT_ACCEPTED	gst_e2e_review_evidence_2a796a701bda428b9af6b63b36ca69f1	gst_e2e_review_calculation_d584aba2da2c4864b8621296ecdc6de7	\N	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:30:12.558	2026-10-31 13:30:12.558
gst_e2e_purchase_conflict_b7e6f31dc6f1444b890e088b6f8b30de	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	PUR-00071	gst_e2e_supplier_0644c32f8c84448fb99031a27687cd67	CONFLICT	2026-10-31 13:31:24.678	DRAFT	NOT_RECONCILED	NOT_ACCEPTED	\N	\N	\N	0	100.00	0.00	0.00	0.00	100.00	\N	\N	\N	\N	\N	2026-10-31 13:31:24.678	2026-10-31 13:31:24.678
gst_e2e_purchase_98c3c1dc2f394d6da5829a69d8393314	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a		gst_e2e_supplier_0644c32f8c84448fb99031a27687cd67	\N	2026-10-31 13:31:24.678	DRAFT	MATCHED	ACCEPTED	gst_e2e_evidence_d14fdbed67fe46b2990c0b6b0d1fbabf	gst_e2e_calculation_ce33bcf3b2fc4f2d86945c3f94b82eee	gst_e2e_decision_70ac3ee091c0419b8c95127e9d30c834	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:31:24.678	2026-10-31 13:31:24.678
gst_e2e_purchase_success_76ea8052134c4255bccb8912dbf8a483	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	DRAFT-dbf8a483	gst_e2e_supplier_0644c32f8c84448fb99031a27687cd67	SUCCESS-dbf8a483	2026-10-31 13:31:24.678	DRAFT	MATCHED	ACCEPTED	gst_e2e_success_evidence_abf3b283504446cba52e4d2cfdbff12a	gst_e2e_success_calculation_f8bda4a0d8b5485ea70ee014462410b8	gst_e2e_success_decision_0ccc638ca1fd4f17a6e7442fd2525248	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:31:24.678	2026-10-31 13:31:24.678
gst_e2e_purchase_75279e266cd94fa19dcc9ba55b20d90e	gst_e2e_tenant_19035406820a497699286f211ca126f6		gst_e2e_supplier_8b18212293a643b286fb03dcaf60f778	\N	2026-10-31 13:40:27.581	DRAFT	MATCHED	ACCEPTED	gst_e2e_evidence_24845f17dc8c4f41b405d61b219154e7	gst_e2e_calculation_43385fa3b0134e16a271b0485dae43dc	gst_e2e_decision_f7ae5ed91ceb42c7adf2a48accfa760e	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:40:27.581	2026-10-31 13:40:27.581
gst_e2e_purchase_review_01b1bf72aefe4ac3be448510965e1961	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	DRAFT-965e1961	gst_e2e_supplier_0644c32f8c84448fb99031a27687cd67	REVIEW-965e1961	2026-10-31 13:31:24.678	DRAFT	DISCREPANCY_REQUIRES_REVIEW	NOT_ACCEPTED	gst_e2e_review_evidence_9faac4401f5c4a17837a63f74839f3b2	gst_e2e_review_calculation_6478163aa29d44438b825c5bff0655a4	\N	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:31:24.678	2026-10-31 13:31:24.678
gst_e2e_purchase_conflict_a478d5c61a87499aac62848bec9394b1	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	PUR-00071	gst_e2e_supplier_6f18bb9c8af34b50a8d8e375e7946c79	CONFLICT	2026-10-31 13:32:42.82	DRAFT	NOT_RECONCILED	NOT_ACCEPTED	\N	\N	\N	0	100.00	0.00	0.00	0.00	100.00	\N	\N	\N	\N	\N	2026-10-31 13:32:42.82	2026-10-31 13:32:42.82
gst_e2e_purchase_e1cd506f35d44abc874f0d767b4c1f9e	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194		gst_e2e_supplier_6f18bb9c8af34b50a8d8e375e7946c79	\N	2026-10-31 13:32:42.82	DRAFT	MATCHED	ACCEPTED	gst_e2e_evidence_fe75642589d8499d97173a74492d203c	gst_e2e_calculation_55f82681fe4d4b5899627254870c4a66	gst_e2e_decision_1b6c80a8a80e4500873b6b92f35b3f9f	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:32:42.82	2026-10-31 13:32:42.82
gst_e2e_purchase_success_2fec4b5f9403413c9f5984a6c80596a7	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	DRAFT-c80596a7	gst_e2e_supplier_6f18bb9c8af34b50a8d8e375e7946c79	SUCCESS-c80596a7	2026-10-31 13:32:42.82	DRAFT	MATCHED	ACCEPTED	gst_e2e_success_evidence_e4c32e05982c4a31aaf29dd46b1676d2	gst_e2e_success_calculation_660568ca7c2d46d186c6dd369a3ecb05	gst_e2e_success_decision_780e9829a864450b9c94286889230318	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:32:42.82	2026-10-31 13:32:42.82
gst_e2e_purchase_review_f312556a01fb404da660fdefc608049e	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	DRAFT-c608049e	gst_e2e_supplier_6f18bb9c8af34b50a8d8e375e7946c79	REVIEW-c608049e	2026-10-31 13:32:42.82	DRAFT	DISCREPANCY_REQUIRES_REVIEW	NOT_ACCEPTED	gst_e2e_review_evidence_bfa5d42ef38a4dee9422c2b1703fbd59	gst_e2e_review_calculation_d0d3e2aca5c847e499db0ebcd26cf4e3	\N	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:32:42.82	2026-10-31 13:32:42.82
gst_e2e_purchase_conflict_3bc11eb6f8d441d19ba95e044bf9e089	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	PUR-00071	gst_e2e_supplier_509a773065f1481795c14132bcdf8946	CONFLICT	2026-10-31 13:33:55.958	DRAFT	NOT_RECONCILED	NOT_ACCEPTED	\N	\N	\N	0	100.00	0.00	0.00	0.00	100.00	\N	\N	\N	\N	\N	2026-10-31 13:33:55.958	2026-10-31 13:33:55.958
gst_e2e_purchase_52aab46bb4c2488598a650643e7f9d5b	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd		gst_e2e_supplier_509a773065f1481795c14132bcdf8946	\N	2026-10-31 13:33:55.958	DRAFT	MATCHED	ACCEPTED	gst_e2e_evidence_bbf752e53f6a4ae8a3df3bf2755de704	gst_e2e_calculation_34f8800ed731440d883f225c50a4684e	gst_e2e_decision_646af98a1ca640208da6831a2a3ecfb0	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:33:55.958	2026-10-31 13:33:55.958
gst_e2e_purchase_review_90ede778497a4aefb088e565488a515a	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	DRAFT-488a515a	gst_e2e_supplier_509a773065f1481795c14132bcdf8946	REVIEW-488a515a	2026-10-31 13:33:55.958	DRAFT	DISCREPANCY_REQUIRES_REVIEW	NOT_ACCEPTED	gst_e2e_review_evidence_2ec953541b5b46888e2a20fb226a0acb	gst_e2e_review_calculation_8ebea172d8cd46e99851aeaec9ec3b9d	\N	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:33:55.958	2026-10-31 13:33:55.958
gst_e2e_purchase_success_ce69ce80a135405083eb65af66d4e5d2	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	DRAFT-66d4e5d2	gst_e2e_supplier_509a773065f1481795c14132bcdf8946	SUCCESS-66d4e5d2	2026-10-31 13:33:55.958	FINALIZED	MATCHED	ACCEPTED	gst_e2e_success_evidence_8c7e453e8f3d41a1bf9c0e702ab1607a	gst_e2e_success_calculation_30bbede44b124b48842d1f6ff37151f1	gst_e2e_success_decision_1c3eca69348c4952a52333575f45a0ef	0	100.00	0.00	18.00	0.00	118.00	\N	\N	2026-10-31 13:33:57.646	\N	\N	2026-10-31 13:33:55.958	2026-10-31 13:33:57.646
gst_e2e_purchase_conflict_48b276f24cb84c26aba5d56b53369c61	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	PUR-00071	gst_e2e_supplier_f57df7e735f3462bac1432e6082cf6d5	CONFLICT	2026-10-31 13:35:09.31	DRAFT	NOT_RECONCILED	NOT_ACCEPTED	\N	\N	\N	0	100.00	0.00	0.00	0.00	100.00	\N	\N	\N	\N	\N	2026-10-31 13:35:09.31	2026-10-31 13:35:09.31
gst_e2e_purchase_5fd610274c2941c88d5597c4d81883a2	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705		gst_e2e_supplier_f57df7e735f3462bac1432e6082cf6d5	\N	2026-10-31 13:35:09.31	DRAFT	MATCHED	ACCEPTED	gst_e2e_evidence_60a7666d4cfe4d52892b37363704c0a8	gst_e2e_calculation_015e00442f27495e9c8126021064f659	gst_e2e_decision_a72365ff495145e385a8363c396d9f9a	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:35:09.31	2026-10-31 13:35:09.31
gst_e2e_purchase_review_a47a0283ee9640238e7a4e120a1e35f3	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	DRAFT-0a1e35f3	gst_e2e_supplier_f57df7e735f3462bac1432e6082cf6d5	REVIEW-0a1e35f3	2026-10-31 13:35:09.31	DRAFT	DISCREPANCY_REQUIRES_REVIEW	NOT_ACCEPTED	gst_e2e_review_evidence_719a4b6dd1d04a4dad46b20d9384832c	gst_e2e_review_calculation_5e2b6b911747491294d2087390928915	\N	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:35:09.31	2026-10-31 13:35:09.31
gst_e2e_purchase_success_53face98828d459ea964e6ea9de2adb0	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	DRAFT-9de2adb0	gst_e2e_supplier_f57df7e735f3462bac1432e6082cf6d5	SUCCESS-9de2adb0	2026-10-31 13:35:09.31	FINALIZED	MATCHED	ACCEPTED	gst_e2e_success_evidence_ba68aa91cac44c6e9929649f15193d6e	gst_e2e_success_calculation_9490e79b1e524ac6839d3212e2d94fd8	gst_e2e_success_decision_6e2551eab23c4550ae1d5a64c4a85c0c	0	100.00	0.00	18.00	0.00	118.00	\N	\N	2026-10-31 13:35:10.977	\N	\N	2026-10-31 13:35:09.31	2026-10-31 13:35:10.977
gst_e2e_purchase_conflict_d3f3384777c64aaeae22abf7c780bb08	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	PUR-00071	gst_e2e_supplier_b480da5f573d495fb4e753482b2abe9e	CONFLICT	2026-10-31 13:36:28.408	DRAFT	NOT_RECONCILED	NOT_ACCEPTED	\N	\N	\N	0	100.00	0.00	0.00	0.00	100.00	\N	\N	\N	\N	\N	2026-10-31 13:36:28.408	2026-10-31 13:36:28.408
gst_e2e_purchase_3753f502598d4c098c1253bfdbeb1399	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f		gst_e2e_supplier_b480da5f573d495fb4e753482b2abe9e	\N	2026-10-31 13:36:28.408	DRAFT	MATCHED	ACCEPTED	gst_e2e_evidence_be3a31ee61eb4bb39f8f74acb22bd228	gst_e2e_calculation_4bf9cc375c644d729e25d7065815816c	gst_e2e_decision_b5b650eb56e940e0a159a7997cd7d0e2	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:36:28.408	2026-10-31 13:36:28.408
gst_e2e_purchase_review_9bef023ab24842b5ba8de45228c6c2ca	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	DRAFT-28c6c2ca	gst_e2e_supplier_b480da5f573d495fb4e753482b2abe9e	REVIEW-28c6c2ca	2026-10-31 13:36:28.408	DRAFT	DISCREPANCY_REQUIRES_REVIEW	NOT_ACCEPTED	gst_e2e_review_evidence_e5b4618372c841ea90ba2741ab8aadcc	gst_e2e_review_calculation_d38b0e50b4994d6e942066d6bafeb045	\N	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:36:28.408	2026-10-31 13:36:28.408
gst_e2e_purchase_success_396c53317f354bc18e427271a7ab8604	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	DRAFT-a7ab8604	gst_e2e_supplier_b480da5f573d495fb4e753482b2abe9e	SUCCESS-a7ab8604	2026-10-31 13:36:28.408	FINALIZED	MATCHED	ACCEPTED	gst_e2e_success_evidence_6224d0b13d8a41d3ac60973ed4702998	gst_e2e_success_calculation_512f5e04b46844b7a1888226774a787e	gst_e2e_success_decision_910191ce0cdd4298b786e79a9a841d43	0	100.00	0.00	18.00	0.00	118.00	\N	\N	2026-10-31 13:36:30.367	\N	\N	2026-10-31 13:36:28.408	2026-10-31 13:36:30.367
gst_e2e_purchase_conflict_303587db53ed42b39609e3519f59f96b	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	PUR-00071	gst_e2e_supplier_c63b60377e9d4a8fa15e5396112df0f2	CONFLICT	2026-10-31 13:37:50.384	DRAFT	NOT_RECONCILED	NOT_ACCEPTED	\N	\N	\N	0	100.00	0.00	0.00	0.00	100.00	\N	\N	\N	\N	\N	2026-10-31 13:37:50.384	2026-10-31 13:37:50.384
gst_e2e_purchase_aa38f212da914bda918c06dc0dc8adf3	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95		gst_e2e_supplier_c63b60377e9d4a8fa15e5396112df0f2	\N	2026-10-31 13:37:50.384	DRAFT	MATCHED	ACCEPTED	gst_e2e_evidence_7471892240924f08b7230dd222ae676c	gst_e2e_calculation_3e6392ed2c5548818aabc00b95162fd5	gst_e2e_decision_e3a5af05e6844b3da38fde99e8b53b82	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:37:50.384	2026-10-31 13:37:50.384
gst_e2e_purchase_review_0b74f3abdc6348debd09627ac5fce657	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	DRAFT-c5fce657	gst_e2e_supplier_c63b60377e9d4a8fa15e5396112df0f2	REVIEW-c5fce657	2026-10-31 13:37:50.384	DRAFT	DISCREPANCY_REQUIRES_REVIEW	NOT_ACCEPTED	gst_e2e_review_evidence_3495581ee622415e9b540931d49ad02b	gst_e2e_review_calculation_0cdf65feebe54f268167529f75835e95	\N	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:37:50.384	2026-10-31 13:37:50.384
gst_e2e_purchase_success_1f164fb2783447d69f85f7df093931fa	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	DRAFT-093931fa	gst_e2e_supplier_c63b60377e9d4a8fa15e5396112df0f2	SUCCESS-093931fa	2026-10-31 13:37:50.384	FINALIZED	MATCHED	ACCEPTED	gst_e2e_success_evidence_8b0d0d4e0e354dfaa6cacf8bb5f0796e	gst_e2e_success_calculation_c7d3e4a852104d058bb5afeb66c0d57c	gst_e2e_success_decision_12a7badbc6734f15b1656434d51ee689	0	100.00	0.00	18.00	0.00	118.00	\N	\N	2026-10-31 13:37:51.74	\N	\N	2026-10-31 13:37:50.384	2026-10-31 13:37:51.74
gst_e2e_purchase_review_893c3e53167b4468ac995d35faf60660	gst_e2e_tenant_19035406820a497699286f211ca126f6	DRAFT-faf60660	gst_e2e_supplier_8b18212293a643b286fb03dcaf60f778	REVIEW-faf60660	2026-10-31 13:40:27.581	DRAFT	DISCREPANCY_REQUIRES_REVIEW	NOT_ACCEPTED	gst_e2e_review_evidence_ce39a492dd844f84bc65e1704cbf846d	gst_e2e_review_calculation_d4f1684e4fe74aa8b087fd351bfca0e3	\N	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:40:27.581	2026-10-31 13:40:27.581
gst_e2e_purchase_conflict_9ecf3baa31284d448f1569a32551da1e	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	PUR-00071	gst_e2e_supplier_f40058d4fa5446239501e43c0d3334ec	CONFLICT	2026-10-31 13:39:14.029	DRAFT	NOT_RECONCILED	NOT_ACCEPTED	\N	\N	\N	0	100.00	0.00	0.00	0.00	100.00	\N	\N	\N	\N	\N	2026-10-31 13:39:14.029	2026-10-31 13:39:14.029
gst_e2e_purchase_38e1c1314c35421aa667471b779fd8ed	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0		gst_e2e_supplier_f40058d4fa5446239501e43c0d3334ec	\N	2026-10-31 13:39:14.029	DRAFT	MATCHED	ACCEPTED	gst_e2e_evidence_9bf2b25253a94cb18716fabf4462c32d	gst_e2e_calculation_0dd6d6dc45d94faebbdd86aff90e60d0	gst_e2e_decision_8347f88a4f88416d960ea798fbf25572	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:39:14.029	2026-10-31 13:39:14.029
gst_e2e_purchase_review_0256831e33e6469b837fd9f821575f21	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	DRAFT-21575f21	gst_e2e_supplier_f40058d4fa5446239501e43c0d3334ec	REVIEW-21575f21	2026-10-31 13:39:14.029	DRAFT	DISCREPANCY_REQUIRES_REVIEW	NOT_ACCEPTED	gst_e2e_review_evidence_2b08574534384d909ef83abf776e8139	gst_e2e_review_calculation_02891cde381647ffa7c569621be9cef9	\N	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:39:14.029	2026-10-31 13:39:14.029
gst_e2e_purchase_success_d51c27ab43b145f195d586fed5ac6f01	gst_e2e_tenant_19035406820a497699286f211ca126f6	DRAFT-d5ac6f01	gst_e2e_supplier_8b18212293a643b286fb03dcaf60f778	SUCCESS-d5ac6f01	2026-10-31 13:40:27.581	FINALIZED	MATCHED	ACCEPTED	gst_e2e_success_evidence_f6ff4a916855451d966f3a0a2e2914a1	gst_e2e_success_calculation_c9bc969a79304383920ad682cbaaa2c7	gst_e2e_success_decision_cc459fed9e424115a10ddfa418f55851	0	100.00	0.00	18.00	0.00	118.00	\N	\N	2026-10-31 13:40:29.002	\N	\N	2026-10-31 13:40:27.581	2026-10-31 13:40:29.002
gst_e2e_purchase_success_f29700e5a951456bb04d6db56b016c68	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	DRAFT-6b016c68	gst_e2e_supplier_f40058d4fa5446239501e43c0d3334ec	SUCCESS-6b016c68	2026-10-31 13:39:14.029	FINALIZED	MATCHED	ACCEPTED	gst_e2e_success_evidence_003b9b9272074716b23b802714bac772	gst_e2e_success_calculation_827963418bd54ea6969c49c569e9e62a	gst_e2e_success_decision_e1ca98178f104c5c9ee4b1291cda90fa	0	100.00	0.00	18.00	0.00	118.00	\N	\N	2026-10-31 13:39:15.48	\N	\N	2026-10-31 13:39:14.029	2026-10-31 13:39:15.48
gst_e2e_purchase_conflict_02d6f7b6a5b84a1fa7c4ff50b226c4c7	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	PUR-00071	gst_e2e_supplier_94e79b4473e043ff816317b0b593d282	CONFLICT	2026-10-31 13:41:41.091	DRAFT	NOT_RECONCILED	NOT_ACCEPTED	\N	\N	\N	0	100.00	0.00	0.00	0.00	100.00	\N	\N	\N	\N	\N	2026-10-31 13:41:41.091	2026-10-31 13:41:41.091
gst_e2e_purchase_918bcf5b68ac49f9868815f7667ab03e	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594		gst_e2e_supplier_94e79b4473e043ff816317b0b593d282	\N	2026-10-31 13:41:41.091	DRAFT	MATCHED	ACCEPTED	gst_e2e_evidence_c077e57256d74049b79ebf881c3bfcb9	gst_e2e_calculation_72a6392096d648c58f161d9cbb41b9f7	gst_e2e_decision_f8c548d7113a46a1889ff4ffd7521894	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:41:41.091	2026-10-31 13:41:41.091
gst_e2e_purchase_review_ce842d07899f4922976aa549b4b05524	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	DRAFT-b4b05524	gst_e2e_supplier_94e79b4473e043ff816317b0b593d282	REVIEW-b4b05524	2026-10-31 13:41:41.091	DRAFT	DISCREPANCY_REQUIRES_REVIEW	NOT_ACCEPTED	gst_e2e_review_evidence_1c35351003034d6ebfaa7154d2b9ed4a	gst_e2e_review_calculation_26ccc0f7a2bd4afd9b9b996000da021e	\N	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:41:41.091	2026-10-31 13:41:41.091
gst_e2e_purchase_success_aaefa95e91204a878b000841573921e3	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	DRAFT-573921e3	gst_e2e_supplier_94e79b4473e043ff816317b0b593d282	SUCCESS-573921e3	2026-10-31 13:41:41.091	FINALIZED	MATCHED	ACCEPTED	gst_e2e_success_evidence_0be196c6c4fd4fe08cb963f60d76e2d2	gst_e2e_success_calculation_d80af8cb89c7448eb75f0f4a38046d56	gst_e2e_success_decision_b2413c39f4a6433f8eb2e72de83003d2	0	100.00	0.00	18.00	0.00	118.00	\N	\N	2026-10-31 13:41:42.905	\N	\N	2026-10-31 13:41:41.091	2026-10-31 13:41:42.905
gst_e2e_purchase_conflict_81cfe4eca38546cf8804d317ecae17ce	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	PUR-00071	gst_e2e_supplier_056f63b10ffa45f5a326b206d1a237e2	CONFLICT	2026-10-31 13:42:54.027	DRAFT	NOT_RECONCILED	NOT_ACCEPTED	\N	\N	\N	0	100.00	0.00	0.00	0.00	100.00	\N	\N	\N	\N	\N	2026-10-31 13:42:54.027	2026-10-31 13:42:54.027
gst_e2e_purchase_c8be122a642544c19af214e0c002bc50	gst_e2e_tenant_adfb498cff894b408a51f898333c9626		gst_e2e_supplier_056f63b10ffa45f5a326b206d1a237e2	\N	2026-10-31 13:42:54.027	DRAFT	MATCHED	ACCEPTED	gst_e2e_evidence_f02fab1a55b24cdfaa0596365fc2e4eb	gst_e2e_calculation_d5527014235d42f8835919feb24b358b	gst_e2e_decision_3efddc77bb294ba58c86cb5093fa6e89	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:42:54.027	2026-10-31 13:42:54.027
gst_e2e_purchase_review_7b7228ad313545c9a943eac12755307e	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	DRAFT-2755307e	gst_e2e_supplier_056f63b10ffa45f5a326b206d1a237e2	REVIEW-2755307e	2026-10-31 13:42:54.027	DRAFT	DISCREPANCY_REQUIRES_REVIEW	NOT_ACCEPTED	gst_e2e_review_evidence_6606889db16b4cd6bdcad1248dc52ff5	gst_e2e_review_calculation_0c8f9f798f6a459dbf5551c208ca8fde	\N	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:42:54.027	2026-10-31 13:42:54.027
gst_e2e_purchase_success_b47ae86c87784e399a738d3dc2c10eac	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	DRAFT-c2c10eac	gst_e2e_supplier_056f63b10ffa45f5a326b206d1a237e2	SUCCESS-c2c10eac	2026-10-31 13:42:54.027	FINALIZED	MATCHED	ACCEPTED	gst_e2e_success_evidence_f59ac928f5c04c259ad8042882202825	gst_e2e_success_calculation_8b3d4be0f9b342cd8a1ed133ecd75b26	gst_e2e_success_decision_3315a174cde74ec49b17838c189a1d25	0	100.00	0.00	18.00	0.00	118.00	\N	\N	2026-10-31 13:42:55.788	\N	\N	2026-10-31 13:42:54.027	2026-10-31 13:42:55.788
gst_e2e_purchase_conflict_f9211486704d40aa989fb0d68967e580	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	PUR-00071	gst_e2e_supplier_61ddcc9df9ab450bbe6a88eef8d031d0	CONFLICT	2026-10-31 13:44:31.539	DRAFT	NOT_RECONCILED	NOT_ACCEPTED	\N	\N	\N	0	100.00	0.00	0.00	0.00	100.00	\N	\N	\N	\N	\N	2026-10-31 13:44:31.539	2026-10-31 13:44:31.539
gst_e2e_purchase_fe5b41c96be0472e858393a3bc74bb43	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7		gst_e2e_supplier_61ddcc9df9ab450bbe6a88eef8d031d0	\N	2026-10-31 13:44:31.539	DRAFT	MATCHED	ACCEPTED	gst_e2e_evidence_f054d1ff7680480ea175c8d05e8e4ca2	gst_e2e_calculation_787fa17e6a4d494f8cc1f01af807a37f	gst_e2e_decision_e8bdbdacb77143359d3f83759d1cbeff	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:44:31.539	2026-10-31 13:44:31.539
gst_e2e_purchase_review_0ab7d0b965eb43e5b0540bdcf568a8e8	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	DRAFT-f568a8e8	gst_e2e_supplier_61ddcc9df9ab450bbe6a88eef8d031d0	REVIEW-f568a8e8	2026-10-31 13:44:31.539	DRAFT	DISCREPANCY_REQUIRES_REVIEW	NOT_ACCEPTED	gst_e2e_review_evidence_e14c264ff83d4a2997528cf1f2dad433	gst_e2e_review_calculation_faeebae1dc324f70a693bb32c6858bc9	\N	0	100.00	0.00	18.00	0.00	118.00	\N	\N	\N	\N	\N	2026-10-31 13:44:31.539	2026-10-31 13:44:31.539
gst_e2e_purchase_success_f1dc1040426446d1986b7570aedcf581	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	DRAFT-aedcf581	gst_e2e_supplier_61ddcc9df9ab450bbe6a88eef8d031d0	SUCCESS-aedcf581	2026-10-31 13:44:31.539	FINALIZED	MATCHED	ACCEPTED	gst_e2e_success_evidence_45e48c775fdd4e239520f5d4c3ff4d7b	gst_e2e_success_calculation_1232b7196aac41f592c4f42a730f31b3	gst_e2e_success_decision_9c45bd35c12048519ac60e5108149b3a	0	100.00	0.00	18.00	0.00	118.00	\N	\N	2026-10-31 13:44:33.384	\N	\N	2026-10-31 13:44:31.539	2026-10-31 13:44:33.384
\.


--
-- Data for Name: purchase_posting_operations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_posting_operations (id, tenant_id, purchase_invoice_id, idempotency_key, request_payload_hash, status, result_invoice_no, result_purchase_id, created_at, updated_at) FROM stdin;
cmvwfzncq000nza3tnp34co88	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_purchase_success_ce69ce80a135405083eb65af66d4e5d2	gst-e2e-success-gst_e2e_purchase_success_ce69ce80a135405083eb65af66d4e5d2	179605cc95edfb3e62184d29f3902c97186e5f7a0a7969191d59030daedcdc14	COMPLETED	DRAFT-66d4e5d2	gst_e2e_purchase_success_ce69ce80a135405083eb65af66d4e5d2	2026-10-31 13:33:57.627	2026-10-31 13:33:57.654
cmvwg17x7000nlgot219s5xff	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_purchase_success_53face98828d459ea964e6ea9de2adb0	gst-e2e-success-gst_e2e_purchase_success_53face98828d459ea964e6ea9de2adb0	314f17b3c0196ab2722467e19fa405518a827c48799ab249b273c74794e4f6af	COMPLETED	DRAFT-9de2adb0	gst_e2e_purchase_success_53face98828d459ea964e6ea9de2adb0	2026-10-31 13:35:10.939	2026-10-31 13:35:10.99
cmvwg2x72000n2plh3d6jjope	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_purchase_success_396c53317f354bc18e427271a7ab8604	gst-e2e-success-gst_e2e_purchase_success_396c53317f354bc18e427271a7ab8604	a9ff694df13e0e5d2080338f8f8039c92c35401cfaf03130eb51a5948e5532b4	COMPLETED	DRAFT-a7ab8604	gst_e2e_purchase_success_396c53317f354bc18e427271a7ab8604	2026-10-31 13:36:30.35	2026-10-31 13:36:30.375
cmvwg4nzh000n14ozwuusf1uc	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_purchase_success_1f164fb2783447d69f85f7df093931fa	gst-e2e-success-gst_e2e_purchase_success_1f164fb2783447d69f85f7df093931fa	60088b8d462218593683f39fe2bfa5e083a87f57c2bd7e81f15f829613a936bf	COMPLETED	DRAFT-093931fa	gst_e2e_purchase_success_1f164fb2783447d69f85f7df093931fa	2026-10-31 13:37:51.725	2026-10-31 13:37:51.746
cmvwg6glj000nkez5i3k4n30i	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_purchase_success_f29700e5a951456bb04d6db56b016c68	gst-e2e-success-gst_e2e_purchase_success_f29700e5a951456bb04d6db56b016c68	156ce776b6043b33938c7cbc5b2e8dcd42c6d65660936fbc921f48bd8b075824	COMPLETED	DRAFT-6b016c68	gst_e2e_purchase_success_f29700e5a951456bb04d6db56b016c68	2026-10-31 13:39:15.463	2026-10-31 13:39:15.486
cmvwg81bo000nemkiqsvsj0gq	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_purchase_success_d51c27ab43b145f195d586fed5ac6f01	gst-e2e-success-gst_e2e_purchase_success_d51c27ab43b145f195d586fed5ac6f01	840be2bf716fee5f0a837c0c8f95d48f2f031b0f8647dd03e7bbcfdaa98e12be	COMPLETED	DRAFT-d5ac6f01	gst_e2e_purchase_success_d51c27ab43b145f195d586fed5ac6f01	2026-10-31 13:40:28.981	2026-10-31 13:40:29.011
cmvwg9mcm000ndaac1u4svlqd	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_purchase_success_aaefa95e91204a878b000841573921e3	gst-e2e-success-gst_e2e_purchase_success_aaefa95e91204a878b000841573921e3	dedb6d01d553c8ba58efb1c7c044f4670ca8f6bd1cf9ace2bd810b0edb5ec692	COMPLETED	DRAFT-573921e3	gst_e2e_purchase_success_aaefa95e91204a878b000841573921e3	2026-10-31 13:41:42.887	2026-10-31 13:41:42.911
cmvwgb6kz000nvg91rxgn829l	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_purchase_success_b47ae86c87784e399a738d3dc2c10eac	gst-e2e-success-gst_e2e_purchase_success_b47ae86c87784e399a738d3dc2c10eac	b662896a44ca295749ed57db878c18bc5a7e938c89057798f80aff0c599ba51a	COMPLETED	DRAFT-c2c10eac	gst_e2e_purchase_success_b47ae86c87784e399a738d3dc2c10eac	2026-10-31 13:42:55.763	2026-10-31 13:42:55.796
cmvwgd9w0000netesujui4336	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_purchase_success_f1dc1040426446d1986b7570aedcf581	gst-e2e-success-gst_e2e_purchase_success_f1dc1040426446d1986b7570aedcf581	71dffeee62f34f1645e95d44a5d61bb5281ac334e90f0ec548a584549cb8f66b	COMPLETED	DRAFT-aedcf581	gst_e2e_purchase_success_f1dc1040426446d1986b7570aedcf581	2026-10-31 13:44:33.361	2026-10-31 13:44:33.393
\.


--
-- Data for Name: q14_maintenance_audit; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.q14_maintenance_audit (id, operation_id, actor_id, actor_db_role, trigger_name, table_name, purpose, action, outcome, authorization_result, changed_state, restoration_attempted, restored, post_verification, error_detail, created_at) FROM stdin;
q14-audit-4daa2c84cc1f8d2374bed6c9ba214a78	q14-maint-666f8a84531bfe9a97a11403420482dc	q14-1793428127358-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	SUCCESS	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	\N	2026-10-31 06:28:47.419609+00
q14-audit-294288386e4722f63f5d2583a633e5b3	q14-maint-d5ffc48cd7f42108917be96d1bad4a21	q14-1793428127358-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	FAILED_OPERATION_RESTORED	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_MAINTENANCE_FAILURE	2026-10-31 06:28:47.429048+00
q14-audit-e1f335026aaf7f2aee292b99251171b1	q14-maint-a7e9baade14578cf3d58fb85e0f33253	q14-1793428127358-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	SUCCESS	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_RESTORATION_FAILURE	2026-10-31 06:28:47.43186+00
q14-audit-21edc311e513c9a0dbb9d8ec3a3d49e5	q14-maint-3fb5ddf85eacb9518f2b7d137ba7d321	q14-1793428135758-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	SUCCESS	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	\N	2026-10-31 06:28:55.835082+00
q14-audit-239fec969589dd97a008368203d0d7ee	q14-maint-96a461e806ffabda9b2c81530f4c746f	q14-1793428135758-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	FAILED_OPERATION_RESTORED	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_MAINTENANCE_FAILURE	2026-10-31 06:28:55.847553+00
q14-audit-cae2b309699c809618ce93ce91711735	q14-maint-0a28f19a878c80ce9bf267f0a309c734	q14-1793428135758-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	FAILED_OPERATION_RESTORED	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_RESTORATION_FAILURE	2026-10-31 06:28:55.851983+00
q14-audit-e3046ba80ec4c087ac2c2e5326798841	q14-maint-ddcd599350ac2f689d6215ad655bb9a6	q14-1793428135758-approver	pharmnos_e2e_admin	guard_sales_posting_transition	sales_posting_operations	POSTING_INTEGRITY	DISABLE_ENABLE	DENIED	FAIL_CLOSED	UNCHANGED	f	f	f	Authorization, purpose, allowlist, protection class, or precondition failed	2026-10-31 06:28:55.855598+00
q14-audit-dd7dc4cb6c5f9f22f2fb201a7f13d8ae	q14-maint-f354cac5ed679b4b6dfbf5b293a0fc04	q14-1793428135758-approver	pharmnos_e2e_admin	unknown_trigger	unknown_table	UNKNOWN_PURPOSE	DISABLE_ENABLE	DENIED	FAIL_CLOSED	UNCHANGED	f	f	f	Authorization, purpose, allowlist, protection class, or precondition failed	2026-10-31 06:28:55.858801+00
q14-audit-2a3541e7c58ad4c3c4e3186ad96dbb96	q14-maint-2630ffc7cafb2a574a073b1eff2a5846	q14-1793428141699-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	SUCCESS	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	\N	2026-10-31 06:29:01.771591+00
q14-audit-c2153d59c326f14e2ec165d24d2f71f3	q14-maint-95323fd568b44e74c88976de569e788a	q14-1793428141699-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	FAILED_OPERATION_RESTORED	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_MAINTENANCE_FAILURE	2026-10-31 06:29:01.781725+00
q14-audit-97df524ca7fec940ed913f741a482cdc	q14-maint-fd12380089f0f098b375e078ec1c1e93	q14-1793428141699-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	FAILED_OPERATION_RESTORED	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_RESTORATION_FAILURE	2026-10-31 06:29:01.785266+00
q14-audit-b2b7ae9722aee76b263b4ea3cfa5d00f	q14-maint-23e2e514fe09c45c7e384362970588c3	q14-1793428141699-approver	pharmnos_e2e_admin	guard_sales_posting_transition	sales_posting_operations	POSTING_INTEGRITY	DISABLE_ENABLE	DENIED	FAIL_CLOSED	UNCHANGED	f	f	f	Authorization, purpose, allowlist, protection class, or precondition failed	2026-10-31 06:29:01.788901+00
q14-audit-f8430924ae35ed69c510018f9cccd7f1	q14-maint-372dc6de00a7f8081ddcb349b80830e8	q14-1793428141699-approver	pharmnos_e2e_admin	unknown_trigger	unknown_table	UNKNOWN_PURPOSE	DISABLE_ENABLE	DENIED	FAIL_CLOSED	UNCHANGED	f	f	f	Authorization, purpose, allowlist, protection class, or precondition failed	2026-10-31 06:29:01.79304+00
q14-audit-f81aa88159229de600abb181f34a79bd	q14-maint-56b1cec5987401761b685ac2bf9a6713	q14-1793428156995-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	SUCCESS	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	\N	2026-10-31 06:29:17.075571+00
q14-audit-03621a996145b6ba2a5e44b4904b022d	q14-maint-5c7287193cdcf4149f7c6ea7fafaef11	q14-1793428156995-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	FAILED_OPERATION_RESTORED	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_MAINTENANCE_FAILURE	2026-10-31 06:29:17.08456+00
q14-audit-c76eff0d19abacdc25a62fc08f7c155c	q14-maint-f9ae640f17fa07643df38d9c85eeec92	q14-1793428156995-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	FAILED_OPERATION_RESTORED	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_RESTORATION_FAILURE	2026-10-31 06:29:17.088691+00
q14-audit-5a818f75028370c92465f601053e7370	q14-maint-77d82f82fe6ea1ff66605f6a599d4751	q14-1793428156995-approver	pharmnos_e2e_admin	guard_sales_posting_transition	sales_posting_operations	POSTING_INTEGRITY	DISABLE_ENABLE	DENIED	FAIL_CLOSED	UNCHANGED	f	f	f	Authorization, purpose, allowlist, protection class, or precondition failed	2026-10-31 06:29:17.092554+00
q14-audit-635e09fe1c729a06e9710bf747a1b739	q14-maint-490c3147319b7803692b9510bf17bac9	q14-1793428156995-approver	pharmnos_e2e_admin	unknown_trigger	unknown_table	UNKNOWN_PURPOSE	DISABLE_ENABLE	DENIED	FAIL_CLOSED	UNCHANGED	f	f	f	Authorization, purpose, allowlist, protection class, or precondition failed	2026-10-31 06:29:17.094807+00
q14-audit-58f4e3b3a1f4bc0b3a16e4e8f7f94541	q14-maint-7bfe71a0710dc06acf64cc28e8c36484	q14-1793428163409-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	SUCCESS	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	\N	2026-10-31 06:29:23.487339+00
q14-audit-482d5dfe393cd875baf3ecb4e886f2fe	q14-maint-28984bdf56107bcafc58b9aa34286605	q14-1793428163409-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	FAILED_OPERATION_RESTORED	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_MAINTENANCE_FAILURE	2026-10-31 06:29:23.497527+00
q14-audit-1580880254650b74929f80cbacd963b5	q14-maint-f23f117ffa7951a57180d077b34c3566	q14-1793428163409-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	FAILED_OPERATION_RESTORED	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_RESTORATION_FAILURE	2026-10-31 06:29:23.500711+00
q14-audit-9048f393d44441f1f0c4943e5f97d69b	q14-maint-63a522618aaa9a3975afa4f5964108e0	q14-1793428163409-approver	pharmnos_e2e_admin	guard_sales_posting_transition	sales_posting_operations	POSTING_INTEGRITY	DISABLE_ENABLE	DENIED	FAIL_CLOSED	UNCHANGED	f	f	f	Authorization, purpose, allowlist, protection class, or precondition failed	2026-10-31 06:29:23.505426+00
q14-audit-60e2567ea8a2e14df6416df09d2661a3	q14-maint-2bfe30e5070a2fe50f34abaccba92ea8	q14-1793428163409-approver	pharmnos_e2e_admin	unknown_trigger	unknown_table	UNKNOWN_PURPOSE	DISABLE_ENABLE	DENIED	FAIL_CLOSED	UNCHANGED	f	f	f	Authorization, purpose, allowlist, protection class, or precondition failed	2026-10-31 06:29:23.507455+00
q14-audit-d1143ce9fae95b6080bffef869be2cb3	q14-maint-0c162b38ca82e82608d0c37f7321685f	q14-1793428169511-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	SUCCESS	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	\N	2026-10-31 06:29:29.595578+00
q14-audit-e431746d556adc77d1d0e2a2acb19dca	q14-maint-234f46d545ab77872a875d13c69ad652	q14-1793428169511-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	FAILED_OPERATION_RESTORED	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_MAINTENANCE_FAILURE	2026-10-31 06:29:29.608588+00
q14-audit-61ca6474f3a6d29ee723fa83fd5f8cb5	q14-maint-260e457c0f8b2af2afcd38a3dab7bc45	q14-1793428169511-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	FAILED_OPERATION_RESTORED	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_RESTORATION_FAILURE	2026-10-31 06:29:29.612314+00
q14-audit-41615f7f0df211eeaf5701656372eb81	q14-maint-8a76888dcc60a9d4fcb0b0d7c452a980	q14-1793428169511-approver	pharmnos_e2e_admin	guard_sales_posting_transition	sales_posting_operations	POSTING_INTEGRITY	DISABLE_ENABLE	DENIED	FAIL_CLOSED	UNCHANGED	f	f	f	Authorization, purpose, allowlist, protection class, or precondition failed	2026-10-31 06:29:29.616246+00
q14-audit-6cd8915899b8be40fc68af9a2bcc4d5d	q14-maint-e4e62cea6b02c82b8777de8ec8cebf7a	q14-1793428169511-approver	pharmnos_e2e_admin	unknown_trigger	unknown_table	UNKNOWN_PURPOSE	DISABLE_ENABLE	DENIED	FAIL_CLOSED	UNCHANGED	f	f	f	Authorization, purpose, allowlist, protection class, or precondition failed	2026-10-31 06:29:29.619956+00
q14-audit-31d2cf038c5f6e5f67157a835f7e5548	q14-maint-9d3a227102d914835d0b1067b3cbadd1	q14-1793428213621-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	SUCCESS	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	\N	2026-10-31 06:30:13.691291+00
q14-audit-0dec5f7b98c51562a143e81d72a55a19	q14-maint-8e7ff7d3ec7cac025260b48b0ea4e065	q14-1793428213621-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	FAILED_OPERATION_RESTORED	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_MAINTENANCE_FAILURE	2026-10-31 06:30:13.700763+00
q14-audit-9b1f36ca5aa7ee354e487cfcd293c082	q14-maint-5856f686305d4fefb5c9d33cc26882c8	q14-1793428213621-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	FAILED_OPERATION_RESTORED	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_RESTORATION_FAILURE	2026-10-31 06:30:13.703719+00
q14-audit-d76daffc5f0a5760fc2b78829fd8ad8e	q14-maint-435ee9938c12e3d1f11501da68eebbfa	q14-1793428213621-approver	pharmnos_e2e_admin	guard_sales_posting_transition	sales_posting_operations	POSTING_INTEGRITY	DISABLE_ENABLE	DENIED	FAIL_CLOSED	UNCHANGED	f	f	f	Authorization, purpose, allowlist, protection class, or precondition failed	2026-10-31 06:30:13.7064+00
q14-audit-da5835ba983a338b30aabdb669e5c726	q14-maint-520cd401ff052d9a7bd87f1d3d5043f5	q14-1793428213621-approver	pharmnos_e2e_admin	unknown_trigger	unknown_table	UNKNOWN_PURPOSE	DISABLE_ENABLE	DENIED	FAIL_CLOSED	UNCHANGED	f	f	f	Authorization, purpose, allowlist, protection class, or precondition failed	2026-10-31 06:30:13.707872+00
q14-audit-5ecc7ba358632ea6647ade54f24a9164	q14-maint-47b0fb987b20fd8c20208850b8de2ae8	q14-1793446696706-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	SUCCESS	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	\N	2026-10-31 11:38:16.842599+00
q14-audit-43f063f2c1950af6dea07e4bf5f002d3	q14-maint-fc6c93a6805ac4eff6a6f13909242a9b	q14-1793446696706-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	FAILED_OPERATION_RESTORED	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_MAINTENANCE_FAILURE	2026-10-31 11:38:16.869516+00
q14-audit-797eda5e2b12bb16b88329a82eda9671	q14-maint-39ba247a6772fd97d68e82c3bf1c5aaf	q14-1793446696706-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	FAILED_OPERATION_RESTORED	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_RESTORATION_FAILURE	2026-10-31 11:38:16.87416+00
q14-audit-aa92bef980c7e962db8b8769a9a9b643	q14-maint-f6a3ec81019a7bfdc12a6f28ccf4ad89	q14-1793446696706-approver	pharmnos_e2e_admin	guard_sales_posting_transition	sales_posting_operations	POSTING_INTEGRITY	DISABLE_ENABLE	DENIED	FAIL_CLOSED	UNCHANGED	f	f	f	Authorization, purpose, allowlist, protection class, or precondition failed	2026-10-31 11:38:16.87867+00
q14-audit-4363deca3e73f9cd74dac92bf84d5e18	q14-maint-25e8d4ecb65915ad2ada93818ee55efe	q14-1793446696706-approver	pharmnos_e2e_admin	unknown_trigger	unknown_table	UNKNOWN_PURPOSE	DISABLE_ENABLE	DENIED	FAIL_CLOSED	UNCHANGED	f	f	f	Authorization, purpose, allowlist, protection class, or precondition failed	2026-10-31 11:38:16.881108+00
q14-audit-e3f7ab2c921839c04d651ea0da80edb6	q14-maint-5c3ad9c869b4a8a40523725efb6687ec	q14-1793447733823-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	SUCCESS	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	\N	2026-10-31 11:55:33.981861+00
q14-audit-a6f4c50ec38581af24ee1066b8a20277	q14-maint-0d22038fcf69bb94622eff55e016225a	q14-1793447733823-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	FAILED_OPERATION_RESTORED	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_MAINTENANCE_FAILURE	2026-10-31 11:55:33.989696+00
q14-audit-59f260d82b4cf468ef05e24b93546420	q14-maint-9fa6b44d9a16c5b9943dd71a99c93de5	q14-1793447733823-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	FAILED_OPERATION_RESTORED	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_RESTORATION_FAILURE	2026-10-31 11:55:33.991892+00
q14-audit-a0aa6810e395adfc637e0a7e68b268cc	q14-maint-cea8a441c34a988b69df2830f3acb44a	q14-1793447733823-approver	pharmnos_e2e_admin	guard_sales_posting_transition	sales_posting_operations	POSTING_INTEGRITY	DISABLE_ENABLE	DENIED	FAIL_CLOSED	UNCHANGED	f	f	f	Authorization, purpose, allowlist, protection class, or precondition failed	2026-10-31 11:55:33.99448+00
q14-audit-a50fcf5087e33f67915bd733002c9bc3	q14-maint-16f7609d5520f16c5c8e720aefc91484	q14-1793447733823-approver	pharmnos_e2e_admin	unknown_trigger	unknown_table	UNKNOWN_PURPOSE	DISABLE_ENABLE	DENIED	FAIL_CLOSED	UNCHANGED	f	f	f	Authorization, purpose, allowlist, protection class, or precondition failed	2026-10-31 11:55:33.995698+00
q14-audit-9ed8e285231a3189aa01fff938696313	q14-maint-cbfd2ace71e3fde3fe39596742ce3338	q14-1793452880879-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	SUCCESS	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	\N	2026-10-31 13:21:21.344755+00
q14-audit-976b60dbedcbab95b67f7f647303e2d4	q14-maint-72ab5899d1ea56836fd70f9a070724bb	q14-1793452880879-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	FAILED_OPERATION_RESTORED	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_MAINTENANCE_FAILURE	2026-10-31 13:21:21.391486+00
q14-audit-ab30e29ad22d952fc91adce335bc4ebd	q14-maint-4d55f2dc0d0e53a8b158388453bf4ca2	q14-1793452880879-approver	pharmnos_e2e_admin	q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	DISABLE_ENABLE	FAILED_OPERATION_RESTORED	AUTHORIZED	DISABLED_THEN_ENABLED	t	t	t	SIMULATED_RESTORATION_FAILURE	2026-10-31 13:21:21.398375+00
q14-audit-dd4e8cc3e37081b8c41d7567cdcb2651	q14-maint-b78e976124d6c6bcd70c726b9c778e79	q14-1793452880879-approver	pharmnos_e2e_admin	guard_sales_posting_transition	sales_posting_operations	POSTING_INTEGRITY	DISABLE_ENABLE	DENIED	FAIL_CLOSED	UNCHANGED	f	f	f	Authorization, purpose, allowlist, protection class, or precondition failed	2026-10-31 13:21:21.406413+00
q14-audit-0bff48d315489efb9d830d112d29b102	q14-maint-5d4210962c94ec225a964f0662b940d5	q14-1793452880879-approver	pharmnos_e2e_admin	unknown_trigger	unknown_table	UNKNOWN_PURPOSE	DISABLE_ENABLE	DENIED	FAIL_CLOSED	UNCHANGED	f	f	f	Authorization, purpose, allowlist, protection class, or precondition failed	2026-10-31 13:21:21.413807+00
\.


--
-- Data for Name: q14_maintenance_probe; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.q14_maintenance_probe (id, marker, updated_at) FROM stdin;
q14-1793428127358-probe	before	2026-10-31 06:28:47.410199+00
q14-1793428135758-probe	before	2026-10-31 06:28:55.82064+00
q14-1793428141699-probe	before	2026-10-31 06:29:01.761264+00
q14-1793428156995-probe	before	2026-10-31 06:29:17.060254+00
q14-1793428163409-probe	before	2026-10-31 06:29:23.475484+00
q14-1793428169511-probe	before	2026-10-31 06:29:29.578507+00
q14-1793428213621-probe	before	2026-10-31 06:30:13.679128+00
q14-1793446696706-probe	before	2026-10-31 11:38:16.828239+00
q14-1793447733823-probe	before	2026-10-31 11:55:33.976388+00
q14-1793452880879-probe	before	2026-10-31 13:21:21.328289+00
\.


--
-- Data for Name: q14_soft_delete_audit; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.q14_soft_delete_audit (id, request_id, tenant_id, actor_id, actor_db_role, action, target_table, target_id, outcome, reason, created_at) FROM stdin;
q14-sda-516df5ff5ecf2942ea7491e9ae8449ff	q14-delete-bc7ec78896b72fe5338d98c3cbba3c33	q14-1793428156995-tenant-a	q14-1793428156995-requester	pharmnos_e2e_runtime	REQUEST	products	q14-1793428156995-product-a	REQUESTED	Q14 lifecycle cleanup	2026-10-31 06:29:17.1054+00
q14-sda-23147a62cf4e3794d0ec807e4b817a1b	q14-delete-fe9c7f700accfa84e95ce50de683ccd6	q14-1793428156995-tenant-a	q14-1793428156995-requester	pharmnos_e2e_runtime	DENY	products	q14-1793428156995-product-a	DENIED	DUPLICATE_ACTIVE_REQUEST	2026-10-31 06:29:17.114274+00
q14-sda-2993d6ad14154e2958d96c8c4417c3ab	q14-delete-f32c6c7fa168a7546014416b11bcc6f7	q14-1793428156995-tenant-b	q14-1793428156995-requester	pharmnos_e2e_runtime	DENY	products	q14-1793428156995-product-a	DENIED	REQUEST_AUTHORIZATION_FAILED	2026-10-31 06:29:17.117494+00
q14-sda-408183fd8eee3eb38ec5489597158eec	q14-delete-f17f69bbf5c50895eea3082ff27873f9	q14-1793428156995-tenant-a	q14-1793428156995-requester	pharmnos_e2e_runtime	DENY	sales_invoices	q14-1793428156995-finalized	DENIED	REQUEST_AUTHORIZATION_FAILED	2026-10-31 06:29:17.120296+00
q14-sda-6f9f73e510c40f5dfac07ed925029be1	q14-delete-bc7ec78896b72fe5338d98c3cbba3c33	q14-1793428156995-tenant-a	q14-1793428156995-requester	pharmnos_e2e_admin	DENY	products	q14-1793428156995-product-a	DENIED	APPROVAL_AUTHORIZATION_FAILED	2026-10-31 06:29:17.131787+00
q14-sda-cf2eaa0602e4a20582aad3a507b28062	q14-delete-bc7ec78896b72fe5338d98c3cbba3c33	q14-1793428156995-tenant-a	q14-1793428156995-approver	pharmnos_e2e_admin	APPROVE	products	q14-1793428156995-product-a	APPROVED	\N	2026-10-31 06:29:17.135771+00
q14-sda-a652c8121c2c71ee6c1709c8df605475	q14-delete-bc7ec78896b72fe5338d98c3cbba3c33	q14-1793428156995-tenant-a	q14-1793428156995-approver	pharmnos_e2e_validation	DENY	products	q14-1793428156995-product-a	DENIED	EXECUTION_AUTHORIZATION_FAILED	2026-10-31 06:29:17.143876+00
q14-sda-73cec1a1fed717609c4201300bb3f5fd	q14-delete-bc7ec78896b72fe5338d98c3cbba3c33	q14-1793428156995-tenant-a	q14-1793428156995-executor	pharmnos_e2e_validation	EXECUTE	products	q14-1793428156995-product-a	EXECUTED	\N	2026-10-31 06:29:17.146342+00
q14-sda-013585e6750148894cb1c996cdc03b2b	q14-delete-6eea497542b0cd8be1c104a1475b8dc8	q14-1793428163409-tenant-a	q14-1793428163409-requester	pharmnos_e2e_runtime	REQUEST	products	q14-1793428163409-product-a	REQUESTED	Q14 lifecycle cleanup	2026-10-31 06:29:23.515432+00
q14-sda-b343d671b7cbd8d6b4683dda4767e02e	q14-delete-2ac1580615613c16da6ffa67dfe3a7fe	q14-1793428163409-tenant-a	q14-1793428163409-requester	pharmnos_e2e_runtime	DENY	products	q14-1793428163409-product-a	DENIED	DUPLICATE_ACTIVE_REQUEST	2026-10-31 06:29:23.525414+00
q14-sda-5a6e4893fc4e68acbf54d119bddb8bee	q14-delete-9ab77cf188a20d1e0a5cd53969d4b07c	q14-1793428163409-tenant-b	q14-1793428163409-requester	pharmnos_e2e_runtime	DENY	products	q14-1793428163409-product-a	DENIED	REQUEST_AUTHORIZATION_FAILED	2026-10-31 06:29:23.528183+00
q14-sda-704c54efd3f94195147559772ace52c8	q14-delete-0bb4c9d6931ca87b8471ec6a6054d027	q14-1793428163409-tenant-a	q14-1793428163409-requester	pharmnos_e2e_runtime	DENY	sales_invoices	q14-1793428163409-finalized	DENIED	REQUEST_AUTHORIZATION_FAILED	2026-10-31 06:29:23.530248+00
q14-sda-b2a0c8e1b68dd559e200677a0a2d33d7	q14-delete-6eea497542b0cd8be1c104a1475b8dc8	q14-1793428163409-tenant-a	q14-1793428163409-requester	pharmnos_e2e_admin	DENY	products	q14-1793428163409-product-a	DENIED	APPROVAL_AUTHORIZATION_FAILED	2026-10-31 06:29:23.53956+00
q14-sda-46d151ea8b116990fdda68b2ffda8243	q14-delete-6eea497542b0cd8be1c104a1475b8dc8	q14-1793428163409-tenant-a	q14-1793428163409-approver	pharmnos_e2e_admin	APPROVE	products	q14-1793428163409-product-a	APPROVED	\N	2026-10-31 06:29:23.543946+00
q14-sda-7fcea304f214394e7a89ee60e2c39137	q14-delete-6eea497542b0cd8be1c104a1475b8dc8	q14-1793428163409-tenant-a	q14-1793428163409-approver	pharmnos_e2e_validation	DENY	products	q14-1793428163409-product-a	DENIED	EXECUTION_AUTHORIZATION_FAILED	2026-10-31 06:29:23.549385+00
q14-sda-9188e3aedf0e800fbd46c5e9a461f2ad	q14-delete-6eea497542b0cd8be1c104a1475b8dc8	q14-1793428163409-tenant-a	q14-1793428163409-executor	pharmnos_e2e_validation	EXECUTE	products	q14-1793428163409-product-a	EXECUTED	\N	2026-10-31 06:29:23.552523+00
q14-sda-a1a1934e4b2821adbf008efabdef0f70	q14-1793428163409-expired-request	q14-1793428163409-tenant-a	q14-1793428163409-executor	pharmnos_e2e_validation	DENY	products	q14-1793428163409-product-expired	DENIED	EXECUTION_AUTHORIZATION_FAILED	2026-10-31 06:29:23.566434+00
q14-sda-402a97a48c61ce02d096fa10f585b098	q14-delete-938aeae5accd9198fe7d96882a649d9f	q14-1793428169511-tenant-a	q14-1793428169511-requester	pharmnos_e2e_runtime	REQUEST	products	q14-1793428169511-product-a	REQUESTED	Q14 lifecycle cleanup	2026-10-31 06:29:29.631506+00
q14-sda-d5b2e988f98f8f96b22e868024f0dd18	q14-delete-eb3b0a5a7e6fa1d7e2d8b63a862ce1e2	q14-1793428169511-tenant-a	q14-1793428169511-requester	pharmnos_e2e_runtime	DENY	products	q14-1793428169511-product-a	DENIED	DUPLICATE_ACTIVE_REQUEST	2026-10-31 06:29:29.640909+00
q14-sda-5ec06611b79dc5520624f58ad88be43b	q14-delete-669c6823f915e33e971d9274d86fc696	q14-1793428169511-tenant-b	q14-1793428169511-requester	pharmnos_e2e_runtime	DENY	products	q14-1793428169511-product-a	DENIED	REQUEST_AUTHORIZATION_FAILED	2026-10-31 06:29:29.64366+00
q14-sda-3faa16bae8dd4aa8576cad70af149896	q14-delete-d12fbfbc9f2f701fa235d478cc4d92e8	q14-1793428169511-tenant-a	q14-1793428169511-requester	pharmnos_e2e_runtime	DENY	sales_invoices	q14-1793428169511-finalized	DENIED	REQUEST_AUTHORIZATION_FAILED	2026-10-31 06:29:29.646234+00
q14-sda-c8a4f40b3920c0fd45d18d94edc4b81a	q14-delete-938aeae5accd9198fe7d96882a649d9f	q14-1793428169511-tenant-a	q14-1793428169511-requester	pharmnos_e2e_admin	DENY	products	q14-1793428169511-product-a	DENIED	APPROVAL_AUTHORIZATION_FAILED	2026-10-31 06:29:29.656675+00
q14-sda-718387baab074856f49952e840f3b62e	q14-delete-938aeae5accd9198fe7d96882a649d9f	q14-1793428169511-tenant-a	q14-1793428169511-approver	pharmnos_e2e_admin	APPROVE	products	q14-1793428169511-product-a	APPROVED	\N	2026-10-31 06:29:29.66072+00
q14-sda-70aac0aade564f99f68e817a6121e64b	q14-delete-938aeae5accd9198fe7d96882a649d9f	q14-1793428169511-tenant-a	q14-1793428169511-approver	pharmnos_e2e_validation	DENY	products	q14-1793428169511-product-a	DENIED	EXECUTION_AUTHORIZATION_FAILED	2026-10-31 06:29:29.666375+00
q14-sda-323629af818ed60f3ac11fe20c910a34	q14-delete-938aeae5accd9198fe7d96882a649d9f	q14-1793428169511-tenant-a	q14-1793428169511-executor	pharmnos_e2e_validation	EXECUTE	products	q14-1793428169511-product-a	EXECUTED	\N	2026-10-31 06:29:29.669252+00
q14-sda-d09b6ee9c4ab1923328b585199102d84	q14-1793428169511-expired-request	q14-1793428169511-tenant-a	q14-1793428169511-executor	pharmnos_e2e_validation	DENY	products	q14-1793428169511-product-expired	DENIED	EXECUTION_AUTHORIZATION_FAILED	2026-10-31 06:29:29.685691+00
q14-sda-ab33d260f798139ffa6cfac242b9c735	q14-delete-748b8787fc212553ea876110e1485039	q14-1793428213621-tenant-a	q14-1793428213621-requester	pharmnos_e2e_runtime	REQUEST	products	q14-1793428213621-product-a	REQUESTED	Q14 lifecycle cleanup	2026-10-31 06:30:13.713618+00
q14-sda-ff9f880f04234cb4285b637a7a4bf888	q14-delete-377766e3859a3387a6fa7ff444151e5a	q14-1793428213621-tenant-a	q14-1793428213621-requester	pharmnos_e2e_runtime	DENY	products	q14-1793428213621-product-a	DENIED	DUPLICATE_ACTIVE_REQUEST	2026-10-31 06:30:13.720788+00
q14-sda-e4c20469d9b4c0b35f5c9d425f8b5391	q14-delete-8b1f6d1ed2bd53dc5def250382aa30b6	q14-1793428213621-tenant-b	q14-1793428213621-requester	pharmnos_e2e_runtime	DENY	products	q14-1793428213621-product-a	DENIED	REQUEST_AUTHORIZATION_FAILED	2026-10-31 06:30:13.722768+00
q14-sda-7d49c8f96eb6cc2e8dcc678a804f82e4	q14-delete-334bbb74e23003fd097801a96e1a0948	q14-1793428213621-tenant-a	q14-1793428213621-requester	pharmnos_e2e_runtime	DENY	sales_invoices	q14-1793428213621-finalized	DENIED	REQUEST_AUTHORIZATION_FAILED	2026-10-31 06:30:13.724301+00
q14-sda-1efdfd9c47ded757f3a5c99569b79575	q14-delete-748b8787fc212553ea876110e1485039	q14-1793428213621-tenant-a	q14-1793428213621-requester	pharmnos_e2e_admin	DENY	products	q14-1793428213621-product-a	DENIED	APPROVAL_AUTHORIZATION_FAILED	2026-10-31 06:30:13.729392+00
q14-sda-c5b1955786d005481e8b3b043da284a7	q14-delete-748b8787fc212553ea876110e1485039	q14-1793428213621-tenant-a	q14-1793428213621-approver	pharmnos_e2e_admin	APPROVE	products	q14-1793428213621-product-a	APPROVED	\N	2026-10-31 06:30:13.733103+00
q14-sda-29fc5da994862405d42075ccd84f4b29	q14-delete-748b8787fc212553ea876110e1485039	q14-1793428213621-tenant-a	q14-1793428213621-approver	pharmnos_e2e_validation	DENY	products	q14-1793428213621-product-a	DENIED	EXECUTION_AUTHORIZATION_FAILED	2026-10-31 06:30:13.737462+00
q14-sda-97e17531ae5f998f7cf2e353c9f08504	q14-delete-748b8787fc212553ea876110e1485039	q14-1793428213621-tenant-a	q14-1793428213621-executor	pharmnos_e2e_validation	EXECUTE	products	q14-1793428213621-product-a	EXECUTED	\N	2026-10-31 06:30:13.739287+00
q14-sda-9e4c87f44208be99d8ba32a3863e833c	q14-1793428213621-expired-request	q14-1793428213621-tenant-a	q14-1793428213621-executor	pharmnos_e2e_validation	DENY	products	q14-1793428213621-product-expired	DENIED	EXECUTION_AUTHORIZATION_FAILED	2026-10-31 06:30:13.748169+00
q14-sda-0f4b3882ad2feaf04184dd710dcc4fc4	q14-delete-5b890dd16832de1813b12359bb014846	q14-1793446696706-tenant-a	q14-1793446696706-requester	pharmnos_e2e_runtime	REQUEST	products	q14-1793446696706-product-a	REQUESTED	Q14 lifecycle cleanup	2026-10-31 11:38:16.895275+00
q14-sda-b1078edb73d9a7310354bd8c0615d840	q14-delete-ea5b5c87461c354f0cf31e16dda5c9bf	q14-1793446696706-tenant-a	q14-1793446696706-requester	pharmnos_e2e_runtime	DENY	products	q14-1793446696706-product-a	DENIED	DUPLICATE_ACTIVE_REQUEST	2026-10-31 11:38:16.904385+00
q14-sda-dbff9c30b622e9ef4a670356273934f0	q14-delete-6c4d79571a45f7ec16f412360c49fe6b	q14-1793446696706-tenant-b	q14-1793446696706-requester	pharmnos_e2e_runtime	DENY	products	q14-1793446696706-product-a	DENIED	REQUEST_AUTHORIZATION_FAILED	2026-10-31 11:38:16.909727+00
q14-sda-0e1d71573c71b39c6c24d886ca4d0d93	q14-delete-6d67141f8e106500b8c46ab436806ebb	q14-1793446696706-tenant-a	q14-1793446696706-requester	pharmnos_e2e_runtime	DENY	sales_invoices	q14-1793446696706-missing-finalized	DENIED	REQUEST_AUTHORIZATION_FAILED	2026-10-31 11:38:16.917806+00
q14-sda-e179d0ecf6a61035505462179dc1c1df	q14-delete-5b890dd16832de1813b12359bb014846	q14-1793446696706-tenant-a	q14-1793446696706-requester	pharmnos_e2e_admin	DENY	products	q14-1793446696706-product-a	DENIED	APPROVAL_AUTHORIZATION_FAILED	2026-10-31 11:38:16.925172+00
q14-sda-6f74293894966b2121b7abe06d66bd42	q14-delete-5b890dd16832de1813b12359bb014846	q14-1793446696706-tenant-a	q14-1793446696706-approver	pharmnos_e2e_admin	APPROVE	products	q14-1793446696706-product-a	APPROVED	\N	2026-10-31 11:38:16.929228+00
q14-sda-82e1b273ba1cca90f9adab075185a2d1	q14-delete-5b890dd16832de1813b12359bb014846	q14-1793446696706-tenant-a	q14-1793446696706-approver	pharmnos_e2e_validation	DENY	products	q14-1793446696706-product-a	DENIED	EXECUTION_AUTHORIZATION_FAILED	2026-10-31 11:38:16.934253+00
q14-sda-0fa43efba04054bf845e93a3603d541b	q14-delete-5b890dd16832de1813b12359bb014846	q14-1793446696706-tenant-a	q14-1793446696706-executor	pharmnos_e2e_validation	EXECUTE	products	q14-1793446696706-product-a	EXECUTED	\N	2026-10-31 11:38:16.943341+00
q14-sda-1ca09672bded881e1c1afca39b0da8e4	q14-1793446696706-expired-request	q14-1793446696706-tenant-a	q14-1793446696706-executor	pharmnos_e2e_validation	DENY	products	q14-1793446696706-product-expired	DENIED	EXECUTION_AUTHORIZATION_FAILED	2026-10-31 11:38:16.958728+00
q14-sda-ac6b0c3e571b0b45d9a55e56a3d95fb6	q14-delete-110006074fe180ae0b0258e946829e58	q14-1793447733823-tenant-a	q14-1793447733823-requester	pharmnos_e2e_runtime	REQUEST	products	q14-1793447733823-product-a	REQUESTED	Q14 lifecycle cleanup	2026-10-31 11:55:34.004281+00
q14-sda-cb7ac2545ed8317b94e26ab32b5f0235	q14-delete-9ebaba913944d6f5f4d8a02d52e9a54d	q14-1793447733823-tenant-a	q14-1793447733823-requester	pharmnos_e2e_runtime	DENY	products	q14-1793447733823-product-a	DENIED	DUPLICATE_ACTIVE_REQUEST	2026-10-31 11:55:34.011187+00
q14-sda-798f134825834388002eeea9c4f8cd64	q14-delete-2a57401b49b4fdb166dfac69c66c6d67	q14-1793447733823-tenant-b	q14-1793447733823-requester	pharmnos_e2e_runtime	DENY	products	q14-1793447733823-product-a	DENIED	REQUEST_AUTHORIZATION_FAILED	2026-10-31 11:55:34.013431+00
q14-sda-bf71543cf65eb65aabc6ceb302ef46da	q14-delete-d81ac9ce6e0eb1e6933e057f16f9c627	q14-1793447733823-tenant-a	q14-1793447733823-requester	pharmnos_e2e_runtime	DENY	sales_invoices	q14-1793447733823-missing-finalized	DENIED	REQUEST_AUTHORIZATION_FAILED	2026-10-31 11:55:34.021035+00
q14-sda-b8197ef6edbb0575ea435700b0ab9256	q14-delete-110006074fe180ae0b0258e946829e58	q14-1793447733823-tenant-a	q14-1793447733823-requester	pharmnos_e2e_admin	DENY	products	q14-1793447733823-product-a	DENIED	APPROVAL_AUTHORIZATION_FAILED	2026-10-31 11:55:34.025555+00
q14-sda-177d14a3adc923332530a84c253428ae	q14-delete-110006074fe180ae0b0258e946829e58	q14-1793447733823-tenant-a	q14-1793447733823-approver	pharmnos_e2e_admin	APPROVE	products	q14-1793447733823-product-a	APPROVED	\N	2026-10-31 11:55:34.028932+00
q14-sda-3f74a9a6cd705e1c2c74b229b336f5ec	q14-delete-110006074fe180ae0b0258e946829e58	q14-1793447733823-tenant-a	q14-1793447733823-approver	pharmnos_e2e_validation	DENY	products	q14-1793447733823-product-a	DENIED	EXECUTION_AUTHORIZATION_FAILED	2026-10-31 11:55:34.033377+00
q14-sda-e574182926d5399b34956e80f78704e0	q14-delete-110006074fe180ae0b0258e946829e58	q14-1793447733823-tenant-a	q14-1793447733823-executor	pharmnos_e2e_validation	EXECUTE	products	q14-1793447733823-product-a	EXECUTED	\N	2026-10-31 11:55:34.039582+00
q14-sda-3f8359e81fb7a222844c83b385057ff5	q14-1793447733823-expired-request	q14-1793447733823-tenant-a	q14-1793447733823-executor	pharmnos_e2e_validation	DENY	products	q14-1793447733823-product-expired	DENIED	EXECUTION_AUTHORIZATION_FAILED	2026-10-31 11:55:34.053476+00
q14-sda-76257fbb316763c45c05977c8eb624d3	q14-delete-dd1f10f51e9f7dc91c1e90b62134ec9d	q14-1793452880879-tenant-a	q14-1793452880879-requester	pharmnos_e2e_runtime	REQUEST	products	q14-1793452880879-product-a	REQUESTED	Q14 lifecycle cleanup	2026-10-31 13:21:21.432298+00
q14-sda-f765a8d9f2a078c85197aa71a46db54e	q14-delete-9c90f7665f3d30325bf263964b407fde	q14-1793452880879-tenant-a	q14-1793452880879-requester	pharmnos_e2e_runtime	DENY	products	q14-1793452880879-product-a	DENIED	DUPLICATE_ACTIVE_REQUEST	2026-10-31 13:21:21.449244+00
q14-sda-1b56f1945e6f0769c533beb7a9dacb5b	q14-delete-1ab4910652b24deb78c79a47ad96989e	q14-1793452880879-tenant-b	q14-1793452880879-requester	pharmnos_e2e_runtime	DENY	products	q14-1793452880879-product-a	DENIED	REQUEST_AUTHORIZATION_FAILED	2026-10-31 13:21:21.453103+00
q14-sda-beb18325f06abc66a3a0af6c033d55dd	q14-delete-98b3da56e82bcd6303c6f3a0c1adba84	q14-1793452880879-tenant-a	q14-1793452880879-requester	pharmnos_e2e_runtime	DENY	sales_invoices	q14-1793452880879-missing-finalized	DENIED	REQUEST_AUTHORIZATION_FAILED	2026-10-31 13:21:21.464547+00
q14-sda-09fcc5eaac170922ce24bc29ecb5d761	q14-delete-dd1f10f51e9f7dc91c1e90b62134ec9d	q14-1793452880879-tenant-a	q14-1793452880879-requester	pharmnos_e2e_admin	DENY	products	q14-1793452880879-product-a	DENIED	APPROVAL_AUTHORIZATION_FAILED	2026-10-31 13:21:21.472973+00
q14-sda-c76b922498e9e3299f1dcde50cc444e9	q14-delete-dd1f10f51e9f7dc91c1e90b62134ec9d	q14-1793452880879-tenant-a	q14-1793452880879-approver	pharmnos_e2e_admin	APPROVE	products	q14-1793452880879-product-a	APPROVED	\N	2026-10-31 13:21:21.483819+00
q14-sda-06a11ce37bcc8682d6fcbafaac85c0c9	q14-delete-dd1f10f51e9f7dc91c1e90b62134ec9d	q14-1793452880879-tenant-a	q14-1793452880879-approver	pharmnos_e2e_validation	DENY	products	q14-1793452880879-product-a	DENIED	EXECUTION_AUTHORIZATION_FAILED	2026-10-31 13:21:21.492987+00
q14-sda-9a0f0c16bc5e516d7ff6b4fbac46f11e	q14-delete-dd1f10f51e9f7dc91c1e90b62134ec9d	q14-1793452880879-tenant-a	q14-1793452880879-executor	pharmnos_e2e_validation	EXECUTE	products	q14-1793452880879-product-a	EXECUTED	\N	2026-10-31 13:21:21.504144+00
q14-sda-fc1d696ac60d9c30b4bfb7e87db2687e	q14-1793452880879-expired-request	q14-1793452880879-tenant-a	q14-1793452880879-executor	pharmnos_e2e_validation	DENY	products	q14-1793452880879-product-expired	DENIED	EXECUTION_AUTHORIZATION_FAILED	2026-10-31 13:21:21.523631+00
\.


--
-- Data for Name: q14_soft_delete_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.q14_soft_delete_requests (id, tenant_id, target_table, target_id, reason, requested_by, requested_at, approved_by, approved_at, executed_by, executed_at, expires_at, status) FROM stdin;
q14-delete-bc7ec78896b72fe5338d98c3cbba3c33	q14-1793428156995-tenant-a	products	q14-1793428156995-product-a	Q14 lifecycle cleanup	q14-1793428156995-requester	2026-10-31 06:29:17.1054+00	q14-1793428156995-approver	2026-10-31 06:29:17.135771+00	q14-1793428156995-executor	2026-10-31 06:29:17.146342+00	2026-11-01 06:29:17.1054+00	EXECUTED
q14-delete-6eea497542b0cd8be1c104a1475b8dc8	q14-1793428163409-tenant-a	products	q14-1793428163409-product-a	Q14 lifecycle cleanup	q14-1793428163409-requester	2026-10-31 06:29:23.515432+00	q14-1793428163409-approver	2026-10-31 06:29:23.543946+00	q14-1793428163409-executor	2026-10-31 06:29:23.552523+00	2026-11-01 06:29:23.515432+00	EXECUTED
q14-1793428163409-expired-request	q14-1793428163409-tenant-a	products	q14-1793428163409-product-expired	expired request	q14-1793428163409-requester	2026-10-31 06:29:23.561782+00	q14-1793428163409-approver	2026-10-31 06:29:23.561782+00	\N	\N	2026-10-31 06:28:23.561782+00	APPROVED
q14-delete-938aeae5accd9198fe7d96882a649d9f	q14-1793428169511-tenant-a	products	q14-1793428169511-product-a	Q14 lifecycle cleanup	q14-1793428169511-requester	2026-10-31 06:29:29.631506+00	q14-1793428169511-approver	2026-10-31 06:29:29.66072+00	q14-1793428169511-executor	2026-10-31 06:29:29.669252+00	2026-11-01 06:29:29.631506+00	EXECUTED
q14-1793428169511-expired-request	q14-1793428169511-tenant-a	products	q14-1793428169511-product-expired	expired request	q14-1793428169511-requester	2026-10-31 06:29:29.67909+00	q14-1793428169511-approver	2026-10-31 06:29:29.67909+00	\N	\N	2026-10-31 06:28:29.67909+00	APPROVED
q14-delete-748b8787fc212553ea876110e1485039	q14-1793428213621-tenant-a	products	q14-1793428213621-product-a	Q14 lifecycle cleanup	q14-1793428213621-requester	2026-10-31 06:30:13.713618+00	q14-1793428213621-approver	2026-10-31 06:30:13.733103+00	q14-1793428213621-executor	2026-10-31 06:30:13.739287+00	2026-11-01 06:30:13.713618+00	EXECUTED
q14-1793428213621-expired-request	q14-1793428213621-tenant-a	products	q14-1793428213621-product-expired	expired request	q14-1793428213621-requester	2026-10-31 06:30:13.744116+00	q14-1793428213621-approver	2026-10-31 06:30:13.744116+00	\N	\N	2026-10-31 06:29:13.744116+00	APPROVED
q14-delete-5b890dd16832de1813b12359bb014846	q14-1793446696706-tenant-a	products	q14-1793446696706-product-a	Q14 lifecycle cleanup	q14-1793446696706-requester	2026-10-31 11:38:16.895275+00	q14-1793446696706-approver	2026-10-31 11:38:16.929228+00	q14-1793446696706-executor	2026-10-31 11:38:16.943341+00	2026-11-01 11:38:16.895275+00	EXECUTED
q14-1793446696706-expired-request	q14-1793446696706-tenant-a	products	q14-1793446696706-product-expired	expired request	q14-1793446696706-requester	2026-10-31 11:38:16.954708+00	q14-1793446696706-approver	2026-10-31 11:38:16.954708+00	\N	\N	2026-10-31 11:37:16.954708+00	APPROVED
q14-delete-110006074fe180ae0b0258e946829e58	q14-1793447733823-tenant-a	products	q14-1793447733823-product-a	Q14 lifecycle cleanup	q14-1793447733823-requester	2026-10-31 11:55:34.004281+00	q14-1793447733823-approver	2026-10-31 11:55:34.028932+00	q14-1793447733823-executor	2026-10-31 11:55:34.039582+00	2026-11-01 11:55:34.004281+00	EXECUTED
q14-1793447733823-expired-request	q14-1793447733823-tenant-a	products	q14-1793447733823-product-expired	expired request	q14-1793447733823-requester	2026-10-31 11:55:34.05084+00	q14-1793447733823-approver	2026-10-31 11:55:34.05084+00	\N	\N	2026-10-31 11:54:34.05084+00	APPROVED
q14-delete-dd1f10f51e9f7dc91c1e90b62134ec9d	q14-1793452880879-tenant-a	products	q14-1793452880879-product-a	Q14 lifecycle cleanup	q14-1793452880879-requester	2026-10-31 13:21:21.432298+00	q14-1793452880879-approver	2026-10-31 13:21:21.483819+00	q14-1793452880879-executor	2026-10-31 13:21:21.504144+00	2026-11-01 13:21:21.432298+00	EXECUTED
q14-1793452880879-expired-request	q14-1793452880879-tenant-a	products	q14-1793452880879-product-expired	expired request	q14-1793452880879-requester	2026-10-31 13:21:21.519455+00	q14-1793452880879-approver	2026-10-31 13:21:21.519455+00	\N	\N	2026-10-31 13:20:21.519455+00	APPROVED
\.


--
-- Data for Name: q14_trigger_allowlist; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.q14_trigger_allowlist (trigger_name, table_name, purpose, protection_class, eligible, expected_enabled, created_at) FROM stdin;
prevent_purchase_gst_evidence_revisions_mutation	purchase_gst_evidence_revisions	IMMUTABLE_GST_HISTORY	IMMUTABILITY	f	t	2026-10-31 06:27:06.259507+00
prevent_purchase_gst_line_evidence_mutation	purchase_gst_line_evidence	IMMUTABLE_GST_HISTORY	IMMUTABILITY	f	t	2026-10-31 06:27:06.259507+00
prevent_purchase_gst_calculations_mutation	purchase_gst_calculations	IMMUTABLE_GST_HISTORY	IMMUTABILITY	f	t	2026-10-31 06:27:06.259507+00
prevent_purchase_gst_accounting_decisions_mutation	purchase_gst_accounting_decisions	IMMUTABLE_GST_HISTORY	IMMUTABILITY	f	t	2026-10-31 06:27:06.259507+00
prevent_purchase_gst_reconciliation_events_mutation	purchase_gst_reconciliation_events	IMMUTABLE_RECONCILIATION_HISTORY	IMMUTABILITY	f	t	2026-10-31 06:27:06.259507+00
prevent_purchase_gst_reconciliation_event_lines_mutation	purchase_gst_reconciliation_event_lines	IMMUTABLE_RECONCILIATION_HISTORY	IMMUTABILITY	f	t	2026-10-31 06:27:06.259507+00
prevent_finalized_purchase_mutation	purchase_invoices	FINALIZED_PURCHASE_HISTORY	FINALIZED_HISTORY	f	t	2026-10-31 06:27:06.259507+00
prevent_finalized_sales_invoice_mutation	sales_invoices	FINALIZED_SALES_HISTORY	FINALIZED_HISTORY	f	t	2026-10-31 06:27:06.259507+00
prevent_finalized_sales_item_mutation	sales_invoice_items	FINALIZED_SALES_HISTORY	FINALIZED_HISTORY	f	t	2026-10-31 06:27:06.259507+00
guard_purchase_posting_transition	purchase_posting_operations	POSTING_INTEGRITY	SECURITY	f	t	2026-10-31 06:27:06.259507+00
guard_sales_posting_transition	sales_posting_operations	POSTING_INTEGRITY	SECURITY	f	t	2026-10-31 06:27:06.259507+00
q14_eligible_maintenance_trigger	q14_maintenance_probe	Q14_ALLOWLISTED_PROBE_MAINTENANCE	ELIGIBLE_MAINTENANCE	t	t	2026-10-31 06:27:06.259507+00
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.role_permissions (id, role_id, permission, created_at) FROM stdin;
gst_e2e_permission_finalize_invoice_f85b836483174a9c93e951a3e93fdd3a	gst_e2e_role_67b17b0e9374463c9452711d4a5a47e6	finalize_invoice	2026-10-31 13:29:28.512
gst_e2e_permission_finalize_purchase_eb3428b532c34233860160cc4ff19897	gst_e2e_role_67b17b0e9374463c9452711d4a5a47e6	finalize_purchase	2026-10-31 13:29:28.512
gst_e2e_permission_view_invoice_966e23bc1b82408cba57420a2542ce26	gst_e2e_role_67b17b0e9374463c9452711d4a5a47e6	view_invoice	2026-10-31 13:29:28.512
gst_e2e_permission_view_customer_ledger_3564d46bb70841568ec52f4f70e4a190	gst_e2e_role_67b17b0e9374463c9452711d4a5a47e6	view_customer_ledger	2026-10-31 13:29:28.512
gst_e2e_permission_view_supplier_ledger_3610b3a6ff7143f3be88b2ee0233c72e	gst_e2e_role_67b17b0e9374463c9452711d4a5a47e6	view_supplier_ledger	2026-10-31 13:29:28.512
gst_e2e_permission_edit_product_6869396d5ae24c338cc4783f322954b0	gst_e2e_role_67b17b0e9374463c9452711d4a5a47e6	edit_product	2026-10-31 13:29:28.512
gst_e2e_permission_edit_customer_2e39065d911a4b88b02da7eea42e9943	gst_e2e_role_67b17b0e9374463c9452711d4a5a47e6	edit_customer	2026-10-31 13:29:28.512
gst_e2e_permission_finalize_invoice_beda65812ed24f46ba251e281b9568eb	gst_e2e_role_2e56d5ab9daf4442aff1b69056e58da1	finalize_invoice	2026-10-31 13:29:43.689
gst_e2e_permission_finalize_purchase_8c7529a518ab4b1c8df3c5ca2a7616a2	gst_e2e_role_2e56d5ab9daf4442aff1b69056e58da1	finalize_purchase	2026-10-31 13:29:43.689
gst_e2e_permission_view_invoice_086f503228b647de9a2bc26e5e9e0f9e	gst_e2e_role_2e56d5ab9daf4442aff1b69056e58da1	view_invoice	2026-10-31 13:29:43.689
gst_e2e_permission_view_customer_ledger_566aee969f694b2ab33cdf1c196a12a7	gst_e2e_role_2e56d5ab9daf4442aff1b69056e58da1	view_customer_ledger	2026-10-31 13:29:43.689
gst_e2e_permission_view_supplier_ledger_a5854ac4ca164d39b8dc95dbf738593c	gst_e2e_role_2e56d5ab9daf4442aff1b69056e58da1	view_supplier_ledger	2026-10-31 13:29:43.689
gst_e2e_permission_edit_product_715c7fd01a3247409eeeb7838e3550e1	gst_e2e_role_2e56d5ab9daf4442aff1b69056e58da1	edit_product	2026-10-31 13:29:43.689
gst_e2e_permission_edit_customer_9c49bd0420464209a80756a47b8ea3d0	gst_e2e_role_2e56d5ab9daf4442aff1b69056e58da1	edit_customer	2026-10-31 13:29:43.689
gst_e2e_permission_finalize_invoice_ff088468d4914a32b9d70846555b87f7	gst_e2e_role_3fd234d307304fcfbc70437ecb6eb72a	finalize_invoice	2026-10-31 13:29:58.518
gst_e2e_permission_finalize_purchase_57b2ec87dcf64d2e9c375939deb82a39	gst_e2e_role_3fd234d307304fcfbc70437ecb6eb72a	finalize_purchase	2026-10-31 13:29:58.518
gst_e2e_permission_view_invoice_d94a6a50d89041378e737021d1a8ebe6	gst_e2e_role_3fd234d307304fcfbc70437ecb6eb72a	view_invoice	2026-10-31 13:29:58.518
gst_e2e_permission_view_customer_ledger_ab57b02c253240918bb8bcbbb700114f	gst_e2e_role_3fd234d307304fcfbc70437ecb6eb72a	view_customer_ledger	2026-10-31 13:29:58.518
gst_e2e_permission_view_supplier_ledger_ebcb093cb53f4387a3c0e6177b06c8a7	gst_e2e_role_3fd234d307304fcfbc70437ecb6eb72a	view_supplier_ledger	2026-10-31 13:29:58.518
gst_e2e_permission_edit_product_bdd6152f4e4548ab8c582b1e36f18e2b	gst_e2e_role_3fd234d307304fcfbc70437ecb6eb72a	edit_product	2026-10-31 13:29:58.518
gst_e2e_permission_edit_customer_774fb78b0dec45b4a7df74c9c51323b4	gst_e2e_role_3fd234d307304fcfbc70437ecb6eb72a	edit_customer	2026-10-31 13:29:58.518
gst_e2e_permission_finalize_invoice_180dbc6e31f54347a6d6f2d42b8fb9e8	gst_e2e_role_442b2f5f0f834ff6b2e30d9d966cd6f4	finalize_invoice	2026-10-31 13:30:12.558
gst_e2e_permission_finalize_purchase_cf31fa012ce0458dbd0af82e106390ad	gst_e2e_role_442b2f5f0f834ff6b2e30d9d966cd6f4	finalize_purchase	2026-10-31 13:30:12.558
gst_e2e_permission_view_invoice_f446a40e29484120b4f0adc792794488	gst_e2e_role_442b2f5f0f834ff6b2e30d9d966cd6f4	view_invoice	2026-10-31 13:30:12.558
gst_e2e_permission_view_customer_ledger_dd91dab387a34dee8451ee6db823f3f4	gst_e2e_role_442b2f5f0f834ff6b2e30d9d966cd6f4	view_customer_ledger	2026-10-31 13:30:12.558
gst_e2e_permission_view_supplier_ledger_26b41e35d54543c784ff30013225b6cc	gst_e2e_role_442b2f5f0f834ff6b2e30d9d966cd6f4	view_supplier_ledger	2026-10-31 13:30:12.558
gst_e2e_permission_edit_product_b56e466590e249aab6c32537de6e0be1	gst_e2e_role_442b2f5f0f834ff6b2e30d9d966cd6f4	edit_product	2026-10-31 13:30:12.558
gst_e2e_permission_edit_customer_020ac16388484e6391b2ae437dc9c016	gst_e2e_role_442b2f5f0f834ff6b2e30d9d966cd6f4	edit_customer	2026-10-31 13:30:12.558
gst_e2e_permission_finalize_invoice_4a40d9e12f21429fbae22de8220e5588	gst_e2e_role_4a865af21fcc4325a869b349769edffe	finalize_invoice	2026-10-31 13:31:24.678
gst_e2e_permission_finalize_purchase_5872d9c5106746f79e5cee49ae434be4	gst_e2e_role_4a865af21fcc4325a869b349769edffe	finalize_purchase	2026-10-31 13:31:24.678
gst_e2e_permission_view_invoice_0b278c278c6e42198ca7b6068b48a68a	gst_e2e_role_4a865af21fcc4325a869b349769edffe	view_invoice	2026-10-31 13:31:24.678
gst_e2e_permission_view_customer_ledger_f1bf705488e2434593eeb702e664f98d	gst_e2e_role_4a865af21fcc4325a869b349769edffe	view_customer_ledger	2026-10-31 13:31:24.678
gst_e2e_permission_view_supplier_ledger_b551ad6bb0a64d44882555250f2a07c8	gst_e2e_role_4a865af21fcc4325a869b349769edffe	view_supplier_ledger	2026-10-31 13:31:24.678
gst_e2e_permission_edit_product_e85950375baa4f72ab53a5be2017912e	gst_e2e_role_4a865af21fcc4325a869b349769edffe	edit_product	2026-10-31 13:31:24.678
gst_e2e_permission_edit_customer_1bfd203356404628ac7e5f96a0582b16	gst_e2e_role_4a865af21fcc4325a869b349769edffe	edit_customer	2026-10-31 13:31:24.678
gst_e2e_permission_finalize_invoice_2d4a1b7524bb4940bdc8d5eab4710867	gst_e2e_role_1036ef3bfaa34b5980def96ce15e1c00	finalize_invoice	2026-10-31 13:32:42.82
gst_e2e_permission_finalize_purchase_9b10529d42ea495b8bd21e9293972909	gst_e2e_role_1036ef3bfaa34b5980def96ce15e1c00	finalize_purchase	2026-10-31 13:32:42.82
gst_e2e_permission_view_invoice_78da9672c2074340b78b0839ff4b0a57	gst_e2e_role_1036ef3bfaa34b5980def96ce15e1c00	view_invoice	2026-10-31 13:32:42.82
gst_e2e_permission_view_customer_ledger_1d305c024b4a45e7b69b83b803288677	gst_e2e_role_1036ef3bfaa34b5980def96ce15e1c00	view_customer_ledger	2026-10-31 13:32:42.82
gst_e2e_permission_view_supplier_ledger_82c41c05866948829b61911cbe14942c	gst_e2e_role_1036ef3bfaa34b5980def96ce15e1c00	view_supplier_ledger	2026-10-31 13:32:42.82
gst_e2e_permission_edit_product_15c67ddbb9ab4e9bb8f94177e1981796	gst_e2e_role_1036ef3bfaa34b5980def96ce15e1c00	edit_product	2026-10-31 13:32:42.82
gst_e2e_permission_edit_customer_beb66c56d9d649489bdab76b6c28f427	gst_e2e_role_1036ef3bfaa34b5980def96ce15e1c00	edit_customer	2026-10-31 13:32:42.82
gst_e2e_permission_finalize_invoice_b0f7a7b1547346cda4b39a3b9cc37e85	gst_e2e_role_20ecd850b7ee427688c96eb1bf448799	finalize_invoice	2026-10-31 13:33:55.958
gst_e2e_permission_finalize_purchase_da82f0759dff445a8695d913e183da12	gst_e2e_role_20ecd850b7ee427688c96eb1bf448799	finalize_purchase	2026-10-31 13:33:55.958
gst_e2e_permission_view_invoice_75ec1019cc9f4e329d837c484f067cd9	gst_e2e_role_20ecd850b7ee427688c96eb1bf448799	view_invoice	2026-10-31 13:33:55.958
gst_e2e_permission_view_customer_ledger_617034f9846c4cb7aaf5369fb258cd49	gst_e2e_role_20ecd850b7ee427688c96eb1bf448799	view_customer_ledger	2026-10-31 13:33:55.958
gst_e2e_permission_view_supplier_ledger_a0e788cdfb1446398d339e442bb92df4	gst_e2e_role_20ecd850b7ee427688c96eb1bf448799	view_supplier_ledger	2026-10-31 13:33:55.958
gst_e2e_permission_edit_product_60ae018a42584dd6b94b08d92e4ec6db	gst_e2e_role_20ecd850b7ee427688c96eb1bf448799	edit_product	2026-10-31 13:33:55.958
gst_e2e_permission_edit_customer_3b1e38f91d6146a2a59578ff626138d6	gst_e2e_role_20ecd850b7ee427688c96eb1bf448799	edit_customer	2026-10-31 13:33:55.958
gst_e2e_permission_finalize_invoice_55fcb5a149da445e8db747798e927519	gst_e2e_role_b614efd80c45477ab2a8c36d625bf301	finalize_invoice	2026-10-31 13:35:09.31
gst_e2e_permission_finalize_purchase_d3f7d394b7f449aaa2f7bb9b07d66ed0	gst_e2e_role_b614efd80c45477ab2a8c36d625bf301	finalize_purchase	2026-10-31 13:35:09.31
gst_e2e_permission_view_invoice_328eaeb91200435db868aa50050ceb57	gst_e2e_role_b614efd80c45477ab2a8c36d625bf301	view_invoice	2026-10-31 13:35:09.31
gst_e2e_permission_view_customer_ledger_35966fb68eaf48b7a0faaf88f7d99188	gst_e2e_role_b614efd80c45477ab2a8c36d625bf301	view_customer_ledger	2026-10-31 13:35:09.31
gst_e2e_permission_view_supplier_ledger_a1abae145db84884b52cb36cf84b5463	gst_e2e_role_b614efd80c45477ab2a8c36d625bf301	view_supplier_ledger	2026-10-31 13:35:09.31
gst_e2e_permission_edit_product_66c6da2ebc4244fda7c122fe6db38cc5	gst_e2e_role_b614efd80c45477ab2a8c36d625bf301	edit_product	2026-10-31 13:35:09.31
gst_e2e_permission_edit_customer_14047980d3a44fd488e2e6ccdee084de	gst_e2e_role_b614efd80c45477ab2a8c36d625bf301	edit_customer	2026-10-31 13:35:09.31
gst_e2e_permission_finalize_invoice_49661a7c0c574ac49b0974ef144aedb6	gst_e2e_role_8994a4096ae445e79ada464f95ea0480	finalize_invoice	2026-10-31 13:36:28.408
gst_e2e_permission_finalize_purchase_b1b076cfa7604af490eb5963bbd8ccf8	gst_e2e_role_8994a4096ae445e79ada464f95ea0480	finalize_purchase	2026-10-31 13:36:28.408
gst_e2e_permission_view_invoice_01839c48774544028f8e8ea9aa4a79dc	gst_e2e_role_8994a4096ae445e79ada464f95ea0480	view_invoice	2026-10-31 13:36:28.408
gst_e2e_permission_view_customer_ledger_90b7e2dac0dd4b49805c1532c55597ea	gst_e2e_role_8994a4096ae445e79ada464f95ea0480	view_customer_ledger	2026-10-31 13:36:28.408
gst_e2e_permission_view_supplier_ledger_42a43339f4d340b1806b04206bb6dee5	gst_e2e_role_8994a4096ae445e79ada464f95ea0480	view_supplier_ledger	2026-10-31 13:36:28.408
gst_e2e_permission_edit_product_eb919b6751e9484b840ca112a3a3edb4	gst_e2e_role_8994a4096ae445e79ada464f95ea0480	edit_product	2026-10-31 13:36:28.408
gst_e2e_permission_edit_customer_ec844ac6d1a34c808f8c6b6c0c20fdf2	gst_e2e_role_8994a4096ae445e79ada464f95ea0480	edit_customer	2026-10-31 13:36:28.408
gst_e2e_permission_finalize_invoice_7938435890464c9f9e10ff2610e64d7b	gst_e2e_role_b66e5f7285314af6a1fdf7241267fa1c	finalize_invoice	2026-10-31 13:37:50.384
gst_e2e_permission_finalize_purchase_969fa3da84a34807880eaef0be8315a6	gst_e2e_role_b66e5f7285314af6a1fdf7241267fa1c	finalize_purchase	2026-10-31 13:37:50.384
gst_e2e_permission_view_invoice_5856632c9c8b4677b8518c1555b02d76	gst_e2e_role_b66e5f7285314af6a1fdf7241267fa1c	view_invoice	2026-10-31 13:37:50.384
gst_e2e_permission_view_customer_ledger_653bd4a65c2240b7a1736e51dc6a5e20	gst_e2e_role_b66e5f7285314af6a1fdf7241267fa1c	view_customer_ledger	2026-10-31 13:37:50.384
gst_e2e_permission_view_supplier_ledger_c45f80ff84ff44bcaae054bea9fb20ce	gst_e2e_role_b66e5f7285314af6a1fdf7241267fa1c	view_supplier_ledger	2026-10-31 13:37:50.384
gst_e2e_permission_edit_product_300c7c91997142c9896ac471af8e95f8	gst_e2e_role_b66e5f7285314af6a1fdf7241267fa1c	edit_product	2026-10-31 13:37:50.384
gst_e2e_permission_edit_customer_ef83b405cb5a46e58fb021c91b50f28e	gst_e2e_role_b66e5f7285314af6a1fdf7241267fa1c	edit_customer	2026-10-31 13:37:50.384
gst_e2e_permission_finalize_invoice_fa6e7b655bca4d16960f88f64c9d3f1e	gst_e2e_role_83bdd68b81794d8c9535c7845217e61e	finalize_invoice	2026-10-31 13:39:14.029
gst_e2e_permission_finalize_purchase_8daac63f5d3545ee88ef7fe91f51e6d8	gst_e2e_role_83bdd68b81794d8c9535c7845217e61e	finalize_purchase	2026-10-31 13:39:14.029
gst_e2e_permission_view_invoice_589ccc11d7ad4ab9b4243a0c2f99eec7	gst_e2e_role_83bdd68b81794d8c9535c7845217e61e	view_invoice	2026-10-31 13:39:14.029
gst_e2e_permission_view_customer_ledger_58ead65beef14e21a57fd7b8ccb021ab	gst_e2e_role_83bdd68b81794d8c9535c7845217e61e	view_customer_ledger	2026-10-31 13:39:14.029
gst_e2e_permission_view_supplier_ledger_484ff4c134d746f6904a02f839f4ff9d	gst_e2e_role_83bdd68b81794d8c9535c7845217e61e	view_supplier_ledger	2026-10-31 13:39:14.029
gst_e2e_permission_edit_product_679c0660a0bc46bab6bad74d60f28dc3	gst_e2e_role_83bdd68b81794d8c9535c7845217e61e	edit_product	2026-10-31 13:39:14.029
gst_e2e_permission_edit_customer_00a09e6feee544a49415cff649531734	gst_e2e_role_83bdd68b81794d8c9535c7845217e61e	edit_customer	2026-10-31 13:39:14.029
gst_e2e_permission_finalize_invoice_a5cca9bb67f3498faf698f74ce0708e9	gst_e2e_role_c1e4d2d6616a4cbcb7490da77252c5e0	finalize_invoice	2026-10-31 13:40:27.581
gst_e2e_permission_finalize_purchase_b985f53fd03446d8a8e88b1a174255c6	gst_e2e_role_c1e4d2d6616a4cbcb7490da77252c5e0	finalize_purchase	2026-10-31 13:40:27.581
gst_e2e_permission_view_invoice_f8d2c299e5dd4627ac5660d4db6e410d	gst_e2e_role_c1e4d2d6616a4cbcb7490da77252c5e0	view_invoice	2026-10-31 13:40:27.581
gst_e2e_permission_view_customer_ledger_efa16286adcc431c9343b31dcffabf8e	gst_e2e_role_c1e4d2d6616a4cbcb7490da77252c5e0	view_customer_ledger	2026-10-31 13:40:27.581
gst_e2e_permission_view_supplier_ledger_a943477212ce4f5bae7386445c2faeea	gst_e2e_role_c1e4d2d6616a4cbcb7490da77252c5e0	view_supplier_ledger	2026-10-31 13:40:27.581
gst_e2e_permission_edit_product_8815501dd58743fdab2c192f4b097655	gst_e2e_role_c1e4d2d6616a4cbcb7490da77252c5e0	edit_product	2026-10-31 13:40:27.581
gst_e2e_permission_edit_customer_540ce39ed1444f43879a82b54b5ba9bb	gst_e2e_role_c1e4d2d6616a4cbcb7490da77252c5e0	edit_customer	2026-10-31 13:40:27.581
gst_e2e_permission_finalize_invoice_24ea04c65be04a3baef6384ff483fb54	gst_e2e_role_20db3826e5b143b2b5dce898eb489cc2	finalize_invoice	2026-10-31 13:41:41.091
gst_e2e_permission_finalize_purchase_78702aecfbf446c4b0137d61a408f0e8	gst_e2e_role_20db3826e5b143b2b5dce898eb489cc2	finalize_purchase	2026-10-31 13:41:41.091
gst_e2e_permission_view_invoice_1a52d8dccc5c4063a1f0fbb8a34b1dfc	gst_e2e_role_20db3826e5b143b2b5dce898eb489cc2	view_invoice	2026-10-31 13:41:41.091
gst_e2e_permission_view_customer_ledger_3d296fbec0e94e8a8780349f0f9b31b9	gst_e2e_role_20db3826e5b143b2b5dce898eb489cc2	view_customer_ledger	2026-10-31 13:41:41.091
gst_e2e_permission_view_supplier_ledger_5b9d988854b546eebd56335b24e62220	gst_e2e_role_20db3826e5b143b2b5dce898eb489cc2	view_supplier_ledger	2026-10-31 13:41:41.091
gst_e2e_permission_edit_product_017111e97a954a94a8ffef3cb7df9451	gst_e2e_role_20db3826e5b143b2b5dce898eb489cc2	edit_product	2026-10-31 13:41:41.091
gst_e2e_permission_edit_customer_1828aa1771b4483e8a5028250305f9a1	gst_e2e_role_20db3826e5b143b2b5dce898eb489cc2	edit_customer	2026-10-31 13:41:41.091
gst_e2e_permission_finalize_invoice_4d99a6ff88ee47e2a36c5aef87e162c0	gst_e2e_role_28890c5872d647dd9cb9d1bfd4c44da4	finalize_invoice	2026-10-31 13:42:54.027
gst_e2e_permission_finalize_purchase_cbda79034aba412a8504aac354990285	gst_e2e_role_28890c5872d647dd9cb9d1bfd4c44da4	finalize_purchase	2026-10-31 13:42:54.027
gst_e2e_permission_view_invoice_98ae7a5a22e541e59b9b7a5b9ca870b9	gst_e2e_role_28890c5872d647dd9cb9d1bfd4c44da4	view_invoice	2026-10-31 13:42:54.027
gst_e2e_permission_view_customer_ledger_6dad4fcb6d9741009b13f58796762d63	gst_e2e_role_28890c5872d647dd9cb9d1bfd4c44da4	view_customer_ledger	2026-10-31 13:42:54.027
gst_e2e_permission_view_supplier_ledger_ec1c66e4c2dc40d0ac62359ee72e1e2c	gst_e2e_role_28890c5872d647dd9cb9d1bfd4c44da4	view_supplier_ledger	2026-10-31 13:42:54.027
gst_e2e_permission_edit_product_55aba207753442c9809bc9499c35f127	gst_e2e_role_28890c5872d647dd9cb9d1bfd4c44da4	edit_product	2026-10-31 13:42:54.027
gst_e2e_permission_edit_customer_f742008f8975467f9d6f0bcf931c4c99	gst_e2e_role_28890c5872d647dd9cb9d1bfd4c44da4	edit_customer	2026-10-31 13:42:54.027
gst_e2e_permission_finalize_invoice_d8a7f67caffd409db90fc8ff1be7e6eb	gst_e2e_role_a45f98bab75e4d3d9b482e362c20a6b1	finalize_invoice	2026-10-31 13:44:31.539
gst_e2e_permission_finalize_purchase_a19acfe3e30f4e56b464f9541b2d334f	gst_e2e_role_a45f98bab75e4d3d9b482e362c20a6b1	finalize_purchase	2026-10-31 13:44:31.539
gst_e2e_permission_view_invoice_6e1d4796a81642729d1b2420bf11bcd2	gst_e2e_role_a45f98bab75e4d3d9b482e362c20a6b1	view_invoice	2026-10-31 13:44:31.539
gst_e2e_permission_view_customer_ledger_1247cdf73d9c49f58508e9d515402c4e	gst_e2e_role_a45f98bab75e4d3d9b482e362c20a6b1	view_customer_ledger	2026-10-31 13:44:31.539
gst_e2e_permission_view_supplier_ledger_0097368b202d4c4a8250473813e4f8f2	gst_e2e_role_a45f98bab75e4d3d9b482e362c20a6b1	view_supplier_ledger	2026-10-31 13:44:31.539
gst_e2e_permission_edit_product_ba2c175edda24d629a2b3fcf5a785559	gst_e2e_role_a45f98bab75e4d3d9b482e362c20a6b1	edit_product	2026-10-31 13:44:31.539
gst_e2e_permission_edit_customer_e93d4580b1934028938a50a3b3d94b8a	gst_e2e_role_a45f98bab75e4d3d9b482e362c20a6b1	edit_customer	2026-10-31 13:44:31.539
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles (id, tenant_id, name, system_role, description, is_default, created_at, updated_at) FROM stdin;
q10-q14-1793420207911-a-role	q10-q14-1793420207911-a-tenant	Synthetica	\N	\N	t	2026-10-31 04:16:47.969	2026-10-31 04:16:47.969
q10-q14-1793420207911-b-role	q10-q14-1793420207911-b-tenant	Syntheticb	\N	\N	t	2026-10-31 04:16:48.008	2026-10-31 04:16:48.008
q10-q14-1793420214519-a-role	q10-q14-1793420214519-a-tenant	Synthetica	\N	\N	t	2026-10-31 04:16:54.574	2026-10-31 04:16:54.574
q10-q14-1793420214519-b-role	q10-q14-1793420214519-b-tenant	Syntheticb	\N	\N	t	2026-10-31 04:16:54.615	2026-10-31 04:16:54.615
q10-q14-1793420220210-a-role	q10-q14-1793420220210-a-tenant	Synthetica	\N	\N	t	2026-10-31 04:17:00.268	2026-10-31 04:17:00.268
q10-q14-1793420220210-b-role	q10-q14-1793420220210-b-tenant	Syntheticb	\N	\N	t	2026-10-31 04:17:00.306	2026-10-31 04:17:00.306
q10-q14-1793420220210-rollback-role	q10-q14-1793420220210-rollback-tenant	Syntheticrollback	\N	\N	t	2026-10-31 04:17:00.393	2026-10-31 04:17:00.393
q10-q14-1793420220210-concurrent-role	q10-q14-1793420220210-concurrent-tenant	Syntheticconcurrent	\N	\N	t	2026-10-31 04:17:00.434	2026-10-31 04:17:00.434
q10-q14-1793420348045-a-role	q10-q14-1793420348045-a-tenant	Synthetica	\N	\N	t	2026-10-31 04:19:08.093	2026-10-31 04:19:08.093
q10-q14-1793420348045-b-role	q10-q14-1793420348045-b-tenant	Syntheticb	\N	\N	t	2026-10-31 04:19:08.125	2026-10-31 04:19:08.125
q10-q14-1793420355327-a-role	q10-q14-1793420355327-a-tenant	Synthetica	\N	\N	t	2026-10-31 04:19:15.377	2026-10-31 04:19:15.377
q10-q14-1793420355327-b-role	q10-q14-1793420355327-b-tenant	Syntheticb	\N	\N	t	2026-10-31 04:19:15.409	2026-10-31 04:19:15.409
q10-q14-1793420355327-uncertain-role	q10-q14-1793420355327-uncertain-tenant	Syntheticuncertain	\N	\N	t	2026-10-31 04:19:15.469	2026-10-31 04:19:15.469
q10-q14-1793420355327-rollback-role	q10-q14-1793420355327-rollback-tenant	Syntheticrollback	\N	\N	t	2026-10-31 04:19:15.508	2026-10-31 04:19:15.508
q10-q14-1793420355327-concurrent-role	q10-q14-1793420355327-concurrent-tenant	Syntheticconcurrent	\N	\N	t	2026-10-31 04:19:15.538	2026-10-31 04:19:15.538
q10-q14-1793420355327-conflicting-role	q10-q14-1793420355327-conflicting-tenant	Syntheticconflicting	\N	\N	t	2026-10-31 04:19:15.573	2026-10-31 04:19:15.573
q10-q14-1793421051032-a-role	q10-q14-1793421051032-a-tenant	Synthetica	\N	\N	t	2026-10-31 04:30:51.126	2026-10-31 04:30:51.126
q10-q14-1793421051032-b-role	q10-q14-1793421051032-b-tenant	Syntheticb	\N	\N	t	2026-10-31 04:30:51.203	2026-10-31 04:30:51.203
q10-q14-1793421051032-uncertain-role	q10-q14-1793421051032-uncertain-tenant	Syntheticuncertain	\N	\N	t	2026-10-31 04:30:51.365	2026-10-31 04:30:51.365
q10-q14-1793421051032-rollback-role	q10-q14-1793421051032-rollback-tenant	Syntheticrollback	\N	\N	t	2026-10-31 04:30:51.468	2026-10-31 04:30:51.468
q10-q14-1793421051032-concurrent-role	q10-q14-1793421051032-concurrent-tenant	Syntheticconcurrent	\N	\N	t	2026-10-31 04:30:51.534	2026-10-31 04:30:51.534
q10-q14-1793421051032-conflicting-role	q10-q14-1793421051032-conflicting-tenant	Syntheticconflicting	\N	\N	t	2026-10-31 04:30:51.605	2026-10-31 04:30:51.605
q10-q14-1793421102644-a-role	q10-q14-1793421102644-a-tenant	Synthetica	\N	\N	t	2026-10-31 04:31:42.721	2026-10-31 04:31:42.721
q10-q14-1793421102644-b-role	q10-q14-1793421102644-b-tenant	Syntheticb	\N	\N	t	2026-10-31 04:31:42.753	2026-10-31 04:31:42.753
q10-q14-1793421102644-uncertain-role	q10-q14-1793421102644-uncertain-tenant	Syntheticuncertain	\N	\N	t	2026-10-31 04:31:42.822	2026-10-31 04:31:42.822
q10-q14-1793421102644-rollback-role	q10-q14-1793421102644-rollback-tenant	Syntheticrollback	\N	\N	t	2026-10-31 04:31:42.862	2026-10-31 04:31:42.862
q10-q14-1793421102644-concurrent-role	q10-q14-1793421102644-concurrent-tenant	Syntheticconcurrent	\N	\N	t	2026-10-31 04:31:42.892	2026-10-31 04:31:42.892
q10-q14-1793421102644-conflicting-role	q10-q14-1793421102644-conflicting-tenant	Syntheticconflicting	\N	\N	t	2026-10-31 04:31:42.928	2026-10-31 04:31:42.928
q10-q14-1793421202430-a-role	q10-q14-1793421202430-a-tenant	Synthetica	\N	\N	t	2026-10-31 04:33:22.534	2026-10-31 04:33:22.534
q10-q14-1793421202430-b-role	q10-q14-1793421202430-b-tenant	Syntheticb	\N	\N	t	2026-10-31 04:33:22.583	2026-10-31 04:33:22.583
q10-q14-1793421202430-uncertain-role	q10-q14-1793421202430-uncertain-tenant	Syntheticuncertain	\N	\N	t	2026-10-31 04:33:22.696	2026-10-31 04:33:22.696
q10-q14-1793421202430-rollback-role	q10-q14-1793421202430-rollback-tenant	Syntheticrollback	\N	\N	t	2026-10-31 04:33:22.771	2026-10-31 04:33:22.771
q10-q14-1793421202430-concurrent-role	q10-q14-1793421202430-concurrent-tenant	Syntheticconcurrent	\N	\N	t	2026-10-31 04:33:22.819	2026-10-31 04:33:22.819
q10-q14-1793421202430-conflicting-role	q10-q14-1793421202430-conflicting-tenant	Syntheticconflicting	\N	\N	t	2026-10-31 04:33:22.877	2026-10-31 04:33:22.877
q10-q14-1793421457888-a-role	q10-q14-1793421457888-a-tenant	Synthetica	\N	\N	t	2026-10-31 04:37:37.984	2026-10-31 04:37:37.984
q10-q14-1793421457888-b-role	q10-q14-1793421457888-b-tenant	Syntheticb	\N	\N	t	2026-10-31 04:37:38.019	2026-10-31 04:37:38.019
q10-q14-1793421457888-uncertain-role	q10-q14-1793421457888-uncertain-tenant	Syntheticuncertain	\N	\N	t	2026-10-31 04:37:38.092	2026-10-31 04:37:38.092
q10-q14-1793421457888-rollback-role	q10-q14-1793421457888-rollback-tenant	Syntheticrollback	\N	\N	t	2026-10-31 04:37:38.14	2026-10-31 04:37:38.14
q10-q14-1793421457888-concurrent-role	q10-q14-1793421457888-concurrent-tenant	Syntheticconcurrent	\N	\N	t	2026-10-31 04:37:38.176	2026-10-31 04:37:38.176
q10-q14-1793421457888-conflicting-role	q10-q14-1793421457888-conflicting-tenant	Syntheticconflicting	\N	\N	t	2026-10-31 04:37:38.215	2026-10-31 04:37:38.215
q10-q14-1793421934870-a-role	q10-q14-1793421934870-a-tenant	Synthetica	\N	\N	t	2026-10-31 04:45:34.921	2026-10-31 04:45:34.921
q10-q14-1793421934870-b-role	q10-q14-1793421934870-b-tenant	Syntheticb	\N	\N	t	2026-10-31 04:45:34.942	2026-10-31 04:45:34.942
q10-q14-1793421934870-uncertain-role	q10-q14-1793421934870-uncertain-tenant	Syntheticuncertain	\N	\N	t	2026-10-31 04:45:34.984	2026-10-31 04:45:34.984
q10-q14-1793421934870-rollback-role	q10-q14-1793421934870-rollback-tenant	Syntheticrollback	\N	\N	t	2026-10-31 04:45:35.008	2026-10-31 04:45:35.008
q10-q14-1793421934870-concurrent-role	q10-q14-1793421934870-concurrent-tenant	Syntheticconcurrent	\N	\N	t	2026-10-31 04:45:35.026	2026-10-31 04:45:35.026
q10-q14-1793421934870-conflicting-role	q10-q14-1793421934870-conflicting-tenant	Syntheticconflicting	\N	\N	t	2026-10-31 04:45:35.047	2026-10-31 04:45:35.047
q14-1793428127358-role-a	q14-1793428127358-tenant-a	Q14 Role A	\N	\N	t	2026-10-31 06:28:47.398	2026-10-31 06:28:47.398
q14-1793428127358-role-b	q14-1793428127358-tenant-b	Q14 Role B	\N	\N	t	2026-10-31 06:28:47.398	2026-10-31 06:28:47.398
q14-1793428135758-role-a	q14-1793428135758-tenant-a	Q14 Role A	\N	\N	t	2026-10-31 06:28:55.805	2026-10-31 06:28:55.805
q14-1793428135758-role-b	q14-1793428135758-tenant-b	Q14 Role B	\N	\N	t	2026-10-31 06:28:55.805	2026-10-31 06:28:55.805
q14-1793428141699-role-a	q14-1793428141699-tenant-a	Q14 Role A	\N	\N	t	2026-10-31 06:29:01.746	2026-10-31 06:29:01.746
q14-1793428141699-role-b	q14-1793428141699-tenant-b	Q14 Role B	\N	\N	t	2026-10-31 06:29:01.746	2026-10-31 06:29:01.746
q14-1793428156995-role-a	q14-1793428156995-tenant-a	Q14 Role A	\N	\N	t	2026-10-31 06:29:17.046	2026-10-31 06:29:17.046
q14-1793428156995-role-b	q14-1793428156995-tenant-b	Q14 Role B	\N	\N	t	2026-10-31 06:29:17.046	2026-10-31 06:29:17.046
q14-1793428163409-role-a	q14-1793428163409-tenant-a	Q14 Role A	\N	\N	t	2026-10-31 06:29:23.461	2026-10-31 06:29:23.461
q14-1793428163409-role-b	q14-1793428163409-tenant-b	Q14 Role B	\N	\N	t	2026-10-31 06:29:23.461	2026-10-31 06:29:23.461
q14-1793428169511-role-a	q14-1793428169511-tenant-a	Q14 Role A	\N	\N	t	2026-10-31 06:29:29.561	2026-10-31 06:29:29.561
q14-1793428169511-role-b	q14-1793428169511-tenant-b	Q14 Role B	\N	\N	t	2026-10-31 06:29:29.561	2026-10-31 06:29:29.561
q10-q14-1793428172549-a-role	q10-q14-1793428172549-a-tenant	Synthetica	\N	\N	t	2026-10-31 06:29:32.66	2026-10-31 06:29:32.66
q10-q14-1793428172549-b-role	q10-q14-1793428172549-b-tenant	Syntheticb	\N	\N	t	2026-10-31 06:29:32.707	2026-10-31 06:29:32.707
q10-q14-1793428172549-uncertain-role	q10-q14-1793428172549-uncertain-tenant	Syntheticuncertain	\N	\N	t	2026-10-31 06:29:32.813	2026-10-31 06:29:32.813
q10-q14-1793428172549-rollback-role	q10-q14-1793428172549-rollback-tenant	Syntheticrollback	\N	\N	t	2026-10-31 06:29:32.882	2026-10-31 06:29:32.882
q10-q14-1793428172549-concurrent-role	q10-q14-1793428172549-concurrent-tenant	Syntheticconcurrent	\N	\N	t	2026-10-31 06:29:32.931	2026-10-31 06:29:32.931
q10-q14-1793428172549-conflicting-role	q10-q14-1793428172549-conflicting-tenant	Syntheticconflicting	\N	\N	t	2026-10-31 06:29:32.989	2026-10-31 06:29:32.989
q14-1793428213621-role-a	q14-1793428213621-tenant-a	Q14 Role A	\N	\N	t	2026-10-31 06:30:13.665	2026-10-31 06:30:13.665
q14-1793428213621-role-b	q14-1793428213621-tenant-b	Q14 Role B	\N	\N	t	2026-10-31 06:30:13.665	2026-10-31 06:30:13.665
q10-q14-1793428213936-a-role	q10-q14-1793428213936-a-tenant	Synthetica	\N	\N	t	2026-10-31 06:30:14.025	2026-10-31 06:30:14.025
q10-q14-1793428213936-b-role	q10-q14-1793428213936-b-tenant	Syntheticb	\N	\N	t	2026-10-31 06:30:14.06	2026-10-31 06:30:14.06
q10-q14-1793428213936-uncertain-role	q10-q14-1793428213936-uncertain-tenant	Syntheticuncertain	\N	\N	t	2026-10-31 06:30:14.142	2026-10-31 06:30:14.142
q10-q14-1793428213936-rollback-role	q10-q14-1793428213936-rollback-tenant	Syntheticrollback	\N	\N	t	2026-10-31 06:30:14.193	2026-10-31 06:30:14.193
q10-q14-1793428213936-concurrent-role	q10-q14-1793428213936-concurrent-tenant	Syntheticconcurrent	\N	\N	t	2026-10-31 06:30:14.226	2026-10-31 06:30:14.226
q10-q14-1793428213936-conflicting-role	q10-q14-1793428213936-conflicting-tenant	Syntheticconflicting	\N	\N	t	2026-10-31 06:30:14.264	2026-10-31 06:30:14.264
q10-app-1793446286377-role	q10-app-1793446286377-tenant	Q10 Application Role	\N	\N	t	2026-10-31 11:31:26.379	2026-10-31 11:31:26.379
q10-app-1793446489184-role	q10-app-1793446489184-tenant	Q10 Application Role	\N	\N	t	2026-10-31 11:34:49.185	2026-10-31 11:34:49.185
q10-app-1793446623070-role	q10-app-1793446623070-tenant	Q10 Application Role	\N	\N	t	2026-10-31 11:37:03.072	2026-10-31 11:37:03.072
q14-1793446696706-role-a	q14-1793446696706-tenant-a	Q14 Role A	\N	\N	t	2026-10-31 11:38:16.81	2026-10-31 11:38:16.81
q14-1793446696706-role-b	q14-1793446696706-tenant-b	Q14 Role B	\N	\N	t	2026-10-31 11:38:16.81	2026-10-31 11:38:16.81
q10-q14-1793446761696-a-role	q10-q14-1793446761696-a-tenant	Synthetica	\N	\N	t	2026-10-31 11:39:21.775	2026-10-31 11:39:21.775
q10-q14-1793446761696-b-role	q10-q14-1793446761696-b-tenant	Syntheticb	\N	\N	t	2026-10-31 11:39:21.805	2026-10-31 11:39:21.805
q10-q14-1793446761696-uncertain-role	q10-q14-1793446761696-uncertain-tenant	Syntheticuncertain	\N	\N	t	2026-10-31 11:39:21.875	2026-10-31 11:39:21.875
q10-q14-1793446761696-rollback-role	q10-q14-1793446761696-rollback-tenant	Syntheticrollback	\N	\N	t	2026-10-31 11:39:21.92	2026-10-31 11:39:21.92
q10-q14-1793446761696-concurrent-role	q10-q14-1793446761696-concurrent-tenant	Syntheticconcurrent	\N	\N	t	2026-10-31 11:39:21.948	2026-10-31 11:39:21.948
q10-q14-1793446761696-conflicting-role	q10-q14-1793446761696-conflicting-tenant	Syntheticconflicting	\N	\N	t	2026-10-31 11:39:21.986	2026-10-31 11:39:21.986
q10-app-1793447402381-role	q10-app-1793447402381-tenant	Q10 Application Role	\N	\N	t	2026-10-31 11:50:02.383	2026-10-31 11:50:02.383
q10-app-1793447603960-role	q10-app-1793447603960-tenant	Q10 Application Role	\N	\N	t	2026-10-31 11:53:23.961	2026-10-31 11:53:23.961
q10-q14-1793447682627-a-role	q10-q14-1793447682627-a-tenant	Synthetica	\N	\N	t	2026-10-31 11:54:42.698	2026-10-31 11:54:42.698
q10-q14-1793447682627-b-role	q10-q14-1793447682627-b-tenant	Syntheticb	\N	\N	t	2026-10-31 11:54:42.739	2026-10-31 11:54:42.739
q10-q14-1793447682627-uncertain-role	q10-q14-1793447682627-uncertain-tenant	Syntheticuncertain	\N	\N	t	2026-10-31 11:54:42.819	2026-10-31 11:54:42.819
q10-q14-1793447682627-rollback-role	q10-q14-1793447682627-rollback-tenant	Syntheticrollback	\N	\N	t	2026-10-31 11:54:42.863	2026-10-31 11:54:42.863
q10-q14-1793447682627-concurrent-role	q10-q14-1793447682627-concurrent-tenant	Syntheticconcurrent	\N	\N	t	2026-10-31 11:54:42.897	2026-10-31 11:54:42.897
q10-q14-1793447682627-conflicting-role	q10-q14-1793447682627-conflicting-tenant	Syntheticconflicting	\N	\N	t	2026-10-31 11:54:42.93	2026-10-31 11:54:42.93
q14-1793447733823-role-a	q14-1793447733823-tenant-a	Q14 Role A	\N	\N	t	2026-10-31 11:55:33.962	2026-10-31 11:55:33.962
q14-1793447733823-role-b	q14-1793447733823-tenant-b	Q14 Role B	\N	\N	t	2026-10-31 11:55:33.962	2026-10-31 11:55:33.962
q10-app-1793452881250-role	q10-app-1793452881250-tenant	Q10 Application Role	\N	\N	t	2026-10-31 13:21:21.252	2026-10-31 13:21:21.252
q14-1793452880879-role-a	q14-1793452880879-tenant-a	Q14 Role A	\N	\N	t	2026-10-31 13:21:21.303	2026-10-31 13:21:21.303
q14-1793452880879-role-b	q14-1793452880879-tenant-b	Q14 Role B	\N	\N	t	2026-10-31 13:21:21.303	2026-10-31 13:21:21.303
q10-app-1793453149906-role	q10-app-1793453149906-tenant	Q10 Application Role	\N	\N	t	2026-10-31 13:25:49.908	2026-10-31 13:25:49.908
gst_e2e_role_67b17b0e9374463c9452711d4a5a47e6	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	GST E2E Role	\N	\N	t	2026-10-31 13:29:28.512	2026-10-31 13:29:28.512
gst_e2e_role_2e56d5ab9daf4442aff1b69056e58da1	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	GST E2E Role	\N	\N	t	2026-10-31 13:29:43.689	2026-10-31 13:29:43.689
gst_e2e_role_3fd234d307304fcfbc70437ecb6eb72a	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	GST E2E Role	\N	\N	t	2026-10-31 13:29:58.518	2026-10-31 13:29:58.518
gst_e2e_role_442b2f5f0f834ff6b2e30d9d966cd6f4	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	GST E2E Role	\N	\N	t	2026-10-31 13:30:12.558	2026-10-31 13:30:12.558
gst_e2e_role_4a865af21fcc4325a869b349769edffe	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	GST E2E Role	\N	\N	t	2026-10-31 13:31:24.678	2026-10-31 13:31:24.678
gst_e2e_role_1036ef3bfaa34b5980def96ce15e1c00	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	GST E2E Role	\N	\N	t	2026-10-31 13:32:42.82	2026-10-31 13:32:42.82
gst_e2e_role_20ecd850b7ee427688c96eb1bf448799	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	GST E2E Role	\N	\N	t	2026-10-31 13:33:55.958	2026-10-31 13:33:55.958
gst_e2e_role_b614efd80c45477ab2a8c36d625bf301	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	GST E2E Role	\N	\N	t	2026-10-31 13:35:09.31	2026-10-31 13:35:09.31
gst_e2e_role_8994a4096ae445e79ada464f95ea0480	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	GST E2E Role	\N	\N	t	2026-10-31 13:36:28.408	2026-10-31 13:36:28.408
gst_e2e_role_b66e5f7285314af6a1fdf7241267fa1c	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	GST E2E Role	\N	\N	t	2026-10-31 13:37:50.384	2026-10-31 13:37:50.384
gst_e2e_role_83bdd68b81794d8c9535c7845217e61e	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	GST E2E Role	\N	\N	t	2026-10-31 13:39:14.029	2026-10-31 13:39:14.029
gst_e2e_role_c1e4d2d6616a4cbcb7490da77252c5e0	gst_e2e_tenant_19035406820a497699286f211ca126f6	GST E2E Role	\N	\N	t	2026-10-31 13:40:27.581	2026-10-31 13:40:27.581
gst_e2e_role_20db3826e5b143b2b5dce898eb489cc2	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	GST E2E Role	\N	\N	t	2026-10-31 13:41:41.091	2026-10-31 13:41:41.091
gst_e2e_role_28890c5872d647dd9cb9d1bfd4c44da4	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	GST E2E Role	\N	\N	t	2026-10-31 13:42:54.027	2026-10-31 13:42:54.027
gst_e2e_role_a45f98bab75e4d3d9b482e362c20a6b1	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	GST E2E Role	\N	\N	t	2026-10-31 13:44:31.539	2026-10-31 13:44:31.539
q10-app-1793454341866-role	q10-app-1793454341866-tenant	Q10 Application Role	\N	\N	t	2026-10-31 13:45:41.869	2026-10-31 13:45:41.869
q10-app-1793454409161-role	q10-app-1793454409161-tenant	Q10 Application Role	\N	\N	t	2026-10-31 13:46:49.162	2026-10-31 13:46:49.162
q10-app-1793454491946-role	q10-app-1793454491946-tenant	Q10 Application Role	\N	\N	t	2026-10-31 13:48:11.948	2026-10-31 13:48:11.948
q10-app-1793460716221-role	q10-app-1793460716221-tenant	Q10 Application Role	\N	\N	t	2026-10-31 15:31:56.222	2026-10-31 15:31:56.222
\.


--
-- Data for Name: sales_invoice_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sales_invoice_items (id, tenant_id, invoice_id, product_id, batch_id, batch_no, quantity, free_qty, sale_rate, mrp, discount_pct, discount_amount, taxable_amount, gst_rate, gst_amount, cgst_amount, sgst_amount, igst_amount, cess_amount, product_name_snapshot, generic_name_snapshot, hsn_code_snapshot, batch_expiry_snapshot, line_total, created_at) FROM stdin;
q10-q14-1793420207911-a-item	q10-q14-1793420207911-a-tenant	q10-q14-1793420207911-a-invoice	q10-q14-1793420207911-a-product	q10-q14-1793420207911-a-batch	q10-q14-1793420207911-a-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:16:47.969
q10-q14-1793420207911-b-item	q10-q14-1793420207911-b-tenant	q10-q14-1793420207911-b-invoice	q10-q14-1793420207911-b-product	q10-q14-1793420207911-b-batch	q10-q14-1793420207911-b-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:16:48.008
q10-q14-1793420214519-a-item	q10-q14-1793420214519-a-tenant	q10-q14-1793420214519-a-invoice	q10-q14-1793420214519-a-product	q10-q14-1793420214519-a-batch	q10-q14-1793420214519-a-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:16:54.574
q10-q14-1793420214519-b-item	q10-q14-1793420214519-b-tenant	q10-q14-1793420214519-b-invoice	q10-q14-1793420214519-b-product	q10-q14-1793420214519-b-batch	q10-q14-1793420214519-b-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:16:54.615
q10-q14-1793420220210-a-item	q10-q14-1793420220210-a-tenant	q10-q14-1793420220210-a-invoice	q10-q14-1793420220210-a-product	q10-q14-1793420220210-a-batch	q10-q14-1793420220210-a-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:17:00.268
q10-q14-1793420220210-b-item	q10-q14-1793420220210-b-tenant	q10-q14-1793420220210-b-invoice	q10-q14-1793420220210-b-product	q10-q14-1793420220210-b-batch	q10-q14-1793420220210-b-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:17:00.306
q10-q14-1793420220210-rollback-item	q10-q14-1793420220210-rollback-tenant	q10-q14-1793420220210-rollback-invoice	q10-q14-1793420220210-rollback-product	q10-q14-1793420220210-rollback-batch	q10-q14-1793420220210-rollback-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:17:00.393
q10-q14-1793420220210-concurrent-item	q10-q14-1793420220210-concurrent-tenant	q10-q14-1793420220210-concurrent-invoice	q10-q14-1793420220210-concurrent-product	q10-q14-1793420220210-concurrent-batch	q10-q14-1793420220210-concurrent-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:17:00.434
q10-q14-1793420348045-a-item	q10-q14-1793420348045-a-tenant	q10-q14-1793420348045-a-invoice	q10-q14-1793420348045-a-product	q10-q14-1793420348045-a-batch	q10-q14-1793420348045-a-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:19:08.093
q10-q14-1793420348045-b-item	q10-q14-1793420348045-b-tenant	q10-q14-1793420348045-b-invoice	q10-q14-1793420348045-b-product	q10-q14-1793420348045-b-batch	q10-q14-1793420348045-b-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:19:08.125
q10-q14-1793420355327-a-item	q10-q14-1793420355327-a-tenant	q10-q14-1793420355327-a-invoice	q10-q14-1793420355327-a-product	q10-q14-1793420355327-a-batch	q10-q14-1793420355327-a-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:19:15.377
q10-q14-1793420355327-b-item	q10-q14-1793420355327-b-tenant	q10-q14-1793420355327-b-invoice	q10-q14-1793420355327-b-product	q10-q14-1793420355327-b-batch	q10-q14-1793420355327-b-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:19:15.409
q10-q14-1793420355327-uncertain-item	q10-q14-1793420355327-uncertain-tenant	q10-q14-1793420355327-uncertain-invoice	q10-q14-1793420355327-uncertain-product	q10-q14-1793420355327-uncertain-batch	q10-q14-1793420355327-uncertain-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:19:15.469
q10-q14-1793420355327-rollback-item	q10-q14-1793420355327-rollback-tenant	q10-q14-1793420355327-rollback-invoice	q10-q14-1793420355327-rollback-product	q10-q14-1793420355327-rollback-batch	q10-q14-1793420355327-rollback-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:19:15.508
q10-q14-1793420355327-concurrent-item	q10-q14-1793420355327-concurrent-tenant	q10-q14-1793420355327-concurrent-invoice	q10-q14-1793420355327-concurrent-product	q10-q14-1793420355327-concurrent-batch	q10-q14-1793420355327-concurrent-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:19:15.538
q10-q14-1793420355327-conflicting-item	q10-q14-1793420355327-conflicting-tenant	q10-q14-1793420355327-conflicting-invoice	q10-q14-1793420355327-conflicting-product	q10-q14-1793420355327-conflicting-batch	q10-q14-1793420355327-conflicting-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:19:15.573
q10-q14-1793421051032-a-item	q10-q14-1793421051032-a-tenant	q10-q14-1793421051032-a-invoice	q10-q14-1793421051032-a-product	q10-q14-1793421051032-a-batch	q10-q14-1793421051032-a-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:30:51.126
q10-q14-1793421051032-uncertain-item	q10-q14-1793421051032-uncertain-tenant	q10-q14-1793421051032-uncertain-invoice	q10-q14-1793421051032-uncertain-product	q10-q14-1793421051032-uncertain-batch	q10-q14-1793421051032-uncertain-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:30:51.365
q10-q14-1793421051032-concurrent-item	q10-q14-1793421051032-concurrent-tenant	q10-q14-1793421051032-concurrent-invoice	q10-q14-1793421051032-concurrent-product	q10-q14-1793421051032-concurrent-batch	q10-q14-1793421051032-concurrent-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:30:51.534
q10-q14-1793421051032-conflicting-item	q10-q14-1793421051032-conflicting-tenant	q10-q14-1793421051032-conflicting-invoice	q10-q14-1793421051032-conflicting-product	q10-q14-1793421051032-conflicting-batch	q10-q14-1793421051032-conflicting-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:30:51.605
q10-q14-1793421102644-a-item	q10-q14-1793421102644-a-tenant	q10-q14-1793421102644-a-invoice	q10-q14-1793421102644-a-product	q10-q14-1793421102644-a-batch	q10-q14-1793421102644-a-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:31:42.721
q10-q14-1793421102644-uncertain-item	q10-q14-1793421102644-uncertain-tenant	q10-q14-1793421102644-uncertain-invoice	q10-q14-1793421102644-uncertain-product	q10-q14-1793421102644-uncertain-batch	q10-q14-1793421102644-uncertain-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:31:42.822
q10-q14-1793421102644-concurrent-item	q10-q14-1793421102644-concurrent-tenant	q10-q14-1793421102644-concurrent-invoice	q10-q14-1793421102644-concurrent-product	q10-q14-1793421102644-concurrent-batch	q10-q14-1793421102644-concurrent-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:31:42.892
q10-q14-1793421102644-conflicting-item	q10-q14-1793421102644-conflicting-tenant	q10-q14-1793421102644-conflicting-invoice	q10-q14-1793421102644-conflicting-product	q10-q14-1793421102644-conflicting-batch	q10-q14-1793421102644-conflicting-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:31:42.928
q10-q14-1793421102644-b-item	q10-q14-1793421102644-b-tenant	q10-q14-1793421102644-b-invoice	q10-q14-1793421102644-b-product	q10-q14-1793421102644-b-batch	q10-q14-1793421102644-b-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Synthetic Product b	\N	SYNTHETIC	2027-10-31 04:31:42.753	118.00	2026-10-31 04:31:42.753
q10-q14-1793421051032-rollback-item	q10-q14-1793421051032-rollback-tenant	q10-q14-1793421051032-rollback-invoice	q10-q14-1793421051032-rollback-product	q10-q14-1793421051032-rollback-batch	q10-q14-1793421051032-rollback-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Synthetic Product rollback	\N	SYNTHETIC	2027-10-31 04:30:51.468	118.00	2026-10-31 04:30:51.468
q10-q14-1793421202430-a-item	q10-q14-1793421202430-a-tenant	q10-q14-1793421202430-a-invoice	q10-q14-1793421202430-a-product	q10-q14-1793421202430-a-batch	q10-q14-1793421202430-a-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:33:22.534
q10-q14-1793421202430-uncertain-item	q10-q14-1793421202430-uncertain-tenant	q10-q14-1793421202430-uncertain-invoice	q10-q14-1793421202430-uncertain-product	q10-q14-1793421202430-uncertain-batch	q10-q14-1793421202430-uncertain-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:33:22.696
q10-q14-1793421202430-concurrent-item	q10-q14-1793421202430-concurrent-tenant	q10-q14-1793421202430-concurrent-invoice	q10-q14-1793421202430-concurrent-product	q10-q14-1793421202430-concurrent-batch	q10-q14-1793421202430-concurrent-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:33:22.819
q10-q14-1793421202430-conflicting-item	q10-q14-1793421202430-conflicting-tenant	q10-q14-1793421202430-conflicting-invoice	q10-q14-1793421202430-conflicting-product	q10-q14-1793421202430-conflicting-batch	q10-q14-1793421202430-conflicting-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:33:22.877
q10-q14-1793421202430-rollback-item	q10-q14-1793421202430-rollback-tenant	q10-q14-1793421202430-rollback-invoice	q10-q14-1793421202430-rollback-product	q10-q14-1793421202430-rollback-batch	q10-q14-1793421202430-rollback-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Synthetic Product rollback	\N	SYNTHETIC	2027-10-31 04:33:22.771	118.00	2026-10-31 04:33:22.771
q10-q14-1793421457888-a-item	q10-q14-1793421457888-a-tenant	q10-q14-1793421457888-a-invoice	q10-q14-1793421457888-a-product	q10-q14-1793421457888-a-batch	q10-q14-1793421457888-a-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:37:37.984
q10-q14-1793421457888-uncertain-item	q10-q14-1793421457888-uncertain-tenant	q10-q14-1793421457888-uncertain-invoice	q10-q14-1793421457888-uncertain-product	q10-q14-1793421457888-uncertain-batch	q10-q14-1793421457888-uncertain-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:37:38.092
q10-q14-1793421457888-concurrent-item	q10-q14-1793421457888-concurrent-tenant	q10-q14-1793421457888-concurrent-invoice	q10-q14-1793421457888-concurrent-product	q10-q14-1793421457888-concurrent-batch	q10-q14-1793421457888-concurrent-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:37:38.176
q10-q14-1793421457888-conflicting-item	q10-q14-1793421457888-conflicting-tenant	q10-q14-1793421457888-conflicting-invoice	q10-q14-1793421457888-conflicting-product	q10-q14-1793421457888-conflicting-batch	q10-q14-1793421457888-conflicting-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:37:38.215
q10-q14-1793421457888-b-item	q10-q14-1793421457888-b-tenant	q10-q14-1793421457888-b-invoice	q10-q14-1793421457888-b-product	q10-q14-1793421457888-b-batch	q10-q14-1793421457888-b-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Synthetic Product b	\N	SYNTHETIC	2027-10-31 04:37:38.019	118.00	2026-10-31 04:37:38.019
q10-q14-1793421457888-rollback-item	q10-q14-1793421457888-rollback-tenant	q10-q14-1793421457888-rollback-invoice	q10-q14-1793421457888-rollback-product	q10-q14-1793421457888-rollback-batch	q10-q14-1793421457888-rollback-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Synthetic Product rollback	\N	SYNTHETIC	2027-10-31 04:37:38.14	118.00	2026-10-31 04:37:38.14
q10-q14-1793421202430-b-item	q10-q14-1793421202430-b-tenant	q10-q14-1793421202430-b-invoice	q10-q14-1793421202430-b-product	q10-q14-1793421202430-b-batch	q10-q14-1793421202430-b-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Synthetic Product b	\N	SYNTHETIC	2027-10-31 04:33:22.583	118.00	2026-10-31 04:33:22.583
q10-q14-1793421102644-rollback-item	q10-q14-1793421102644-rollback-tenant	q10-q14-1793421102644-rollback-invoice	q10-q14-1793421102644-rollback-product	q10-q14-1793421102644-rollback-batch	q10-q14-1793421102644-rollback-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Synthetic Product rollback	\N	SYNTHETIC	2027-10-31 04:31:42.862	118.00	2026-10-31 04:31:42.862
q10-q14-1793421051032-b-item	q10-q14-1793421051032-b-tenant	q10-q14-1793421051032-b-invoice	q10-q14-1793421051032-b-product	q10-q14-1793421051032-b-batch	q10-q14-1793421051032-b-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Synthetic Product b	\N	SYNTHETIC	2027-10-31 04:30:51.203	118.00	2026-10-31 04:30:51.203
q10-q14-1793421934870-a-item	q10-q14-1793421934870-a-tenant	q10-q14-1793421934870-a-invoice	q10-q14-1793421934870-a-product	q10-q14-1793421934870-a-batch	q10-q14-1793421934870-a-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:45:34.921
q10-q14-1793421934870-uncertain-item	q10-q14-1793421934870-uncertain-tenant	q10-q14-1793421934870-uncertain-invoice	q10-q14-1793421934870-uncertain-product	q10-q14-1793421934870-uncertain-batch	q10-q14-1793421934870-uncertain-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:45:34.984
q10-q14-1793421934870-concurrent-item	q10-q14-1793421934870-concurrent-tenant	q10-q14-1793421934870-concurrent-invoice	q10-q14-1793421934870-concurrent-product	q10-q14-1793421934870-concurrent-batch	q10-q14-1793421934870-concurrent-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:45:35.026
q10-q14-1793421934870-conflicting-item	q10-q14-1793421934870-conflicting-tenant	q10-q14-1793421934870-conflicting-invoice	q10-q14-1793421934870-conflicting-product	q10-q14-1793421934870-conflicting-batch	q10-q14-1793421934870-conflicting-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 04:45:35.047
q10-q14-1793421934870-rollback-item	q10-q14-1793421934870-rollback-tenant	q10-q14-1793421934870-rollback-invoice	q10-q14-1793421934870-rollback-product	q10-q14-1793421934870-rollback-batch	q10-q14-1793421934870-rollback-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Synthetic Product rollback	\N	SYNTHETIC	2027-10-31 04:45:35.008	118.00	2026-10-31 04:45:35.008
q10-q14-1793421934870-b-item	q10-q14-1793421934870-b-tenant	q10-q14-1793421934870-b-invoice	q10-q14-1793421934870-b-product	q10-q14-1793421934870-b-batch	q10-q14-1793421934870-b-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Synthetic Product b	\N	SYNTHETIC	2027-10-31 04:45:34.942	118.00	2026-10-31 04:45:34.942
q10-q14-1793428172549-a-item	q10-q14-1793428172549-a-tenant	q10-q14-1793428172549-a-invoice	q10-q14-1793428172549-a-product	q10-q14-1793428172549-a-batch	q10-q14-1793428172549-a-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 06:29:32.66
q10-q14-1793428172549-uncertain-item	q10-q14-1793428172549-uncertain-tenant	q10-q14-1793428172549-uncertain-invoice	q10-q14-1793428172549-uncertain-product	q10-q14-1793428172549-uncertain-batch	q10-q14-1793428172549-uncertain-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 06:29:32.813
q10-q14-1793428172549-rollback-item	q10-q14-1793428172549-rollback-tenant	q10-q14-1793428172549-rollback-invoice	q10-q14-1793428172549-rollback-product	q10-q14-1793428172549-rollback-batch	q10-q14-1793428172549-rollback-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Synthetic Product rollback	\N	SYNTHETIC	2027-10-31 06:29:32.882	118.00	2026-10-31 06:29:32.882
q10-q14-1793428172549-b-item	q10-q14-1793428172549-b-tenant	q10-q14-1793428172549-b-invoice	q10-q14-1793428172549-b-product	q10-q14-1793428172549-b-batch	q10-q14-1793428172549-b-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Synthetic Product b	\N	SYNTHETIC	2027-10-31 06:29:32.707	118.00	2026-10-31 06:29:32.707
q10-q14-1793428172549-concurrent-item	q10-q14-1793428172549-concurrent-tenant	q10-q14-1793428172549-concurrent-invoice	q10-q14-1793428172549-concurrent-product	q10-q14-1793428172549-concurrent-batch	q10-q14-1793428172549-concurrent-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 06:29:32.931
q10-q14-1793428172549-conflicting-item	q10-q14-1793428172549-conflicting-tenant	q10-q14-1793428172549-conflicting-invoice	q10-q14-1793428172549-conflicting-product	q10-q14-1793428172549-conflicting-batch	q10-q14-1793428172549-conflicting-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 06:29:32.989
q10-q14-1793428213936-a-item	q10-q14-1793428213936-a-tenant	q10-q14-1793428213936-a-invoice	q10-q14-1793428213936-a-product	q10-q14-1793428213936-a-batch	q10-q14-1793428213936-a-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 06:30:14.025
q10-q14-1793428213936-uncertain-item	q10-q14-1793428213936-uncertain-tenant	q10-q14-1793428213936-uncertain-invoice	q10-q14-1793428213936-uncertain-product	q10-q14-1793428213936-uncertain-batch	q10-q14-1793428213936-uncertain-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 06:30:14.142
q10-q14-1793428213936-concurrent-item	q10-q14-1793428213936-concurrent-tenant	q10-q14-1793428213936-concurrent-invoice	q10-q14-1793428213936-concurrent-product	q10-q14-1793428213936-concurrent-batch	q10-q14-1793428213936-concurrent-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 06:30:14.226
q10-q14-1793428213936-conflicting-item	q10-q14-1793428213936-conflicting-tenant	q10-q14-1793428213936-conflicting-invoice	q10-q14-1793428213936-conflicting-product	q10-q14-1793428213936-conflicting-batch	q10-q14-1793428213936-conflicting-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 06:30:14.264
q10-q14-1793428213936-rollback-item	q10-q14-1793428213936-rollback-tenant	q10-q14-1793428213936-rollback-invoice	q10-q14-1793428213936-rollback-product	q10-q14-1793428213936-rollback-batch	q10-q14-1793428213936-rollback-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Synthetic Product rollback	\N	SYNTHETIC	2027-10-31 06:30:14.193	118.00	2026-10-31 06:30:14.193
q10-q14-1793428213936-b-item	q10-q14-1793428213936-b-tenant	q10-q14-1793428213936-b-invoice	q10-q14-1793428213936-b-product	q10-q14-1793428213936-b-batch	q10-q14-1793428213936-b-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Synthetic Product b	\N	SYNTHETIC	2027-10-31 06:30:14.06	118.00	2026-10-31 06:30:14.06
q10-app-1793446286377-item-2	q10-app-1793446286377-tenant	q10-app-1793446286377-invoice-2	q10-app-1793446286377-product	q10-app-1793446286377-batch	q10-app-1793446286377-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 11:31:26.379
q10-app-1793446286377-item-0	q10-app-1793446286377-tenant	q10-app-1793446286377-invoice-0	q10-app-1793446286377-product	q10-app-1793446286377-batch	q10-app-1793446286377-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Q10 Application Product	\N	SYNTHETIC	2027-10-31 11:31:26.379	118.00	2026-10-31 11:31:26.379
q10-app-1793446286377-item-1	q10-app-1793446286377-tenant	q10-app-1793446286377-invoice-1	q10-app-1793446286377-product	q10-app-1793446286377-batch	q10-app-1793446286377-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Q10 Application Product	\N	SYNTHETIC	2027-10-31 11:31:26.379	118.00	2026-10-31 11:31:26.379
q10-app-1793446489184-item-2	q10-app-1793446489184-tenant	q10-app-1793446489184-invoice-2	q10-app-1793446489184-product	q10-app-1793446489184-batch	q10-app-1793446489184-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 11:34:49.185
q10-app-1793446489184-item-0	q10-app-1793446489184-tenant	q10-app-1793446489184-invoice-0	q10-app-1793446489184-product	q10-app-1793446489184-batch	q10-app-1793446489184-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Q10 Application Product	\N	SYNTHETIC	2027-10-31 11:34:49.185	118.00	2026-10-31 11:34:49.185
q10-app-1793446489184-item-1	q10-app-1793446489184-tenant	q10-app-1793446489184-invoice-1	q10-app-1793446489184-product	q10-app-1793446489184-batch	q10-app-1793446489184-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Q10 Application Product	\N	SYNTHETIC	2027-10-31 11:34:49.185	118.00	2026-10-31 11:34:49.185
q10-app-1793446623070-item-2	q10-app-1793446623070-tenant	q10-app-1793446623070-invoice-2	q10-app-1793446623070-product	q10-app-1793446623070-batch	q10-app-1793446623070-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 11:37:03.072
q10-app-1793446623070-item-0	q10-app-1793446623070-tenant	q10-app-1793446623070-invoice-0	q10-app-1793446623070-product	q10-app-1793446623070-batch	q10-app-1793446623070-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Q10 Application Product	\N	SYNTHETIC	2027-10-31 11:37:03.072	118.00	2026-10-31 11:37:03.072
q10-app-1793446623070-item-1	q10-app-1793446623070-tenant	q10-app-1793446623070-invoice-1	q10-app-1793446623070-product	q10-app-1793446623070-batch	q10-app-1793446623070-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Q10 Application Product	\N	SYNTHETIC	2027-10-31 11:37:03.072	118.00	2026-10-31 11:37:03.072
q10-q14-1793446761696-a-item	q10-q14-1793446761696-a-tenant	q10-q14-1793446761696-a-invoice	q10-q14-1793446761696-a-product	q10-q14-1793446761696-a-batch	q10-q14-1793446761696-a-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 11:39:21.775
q10-q14-1793446761696-b-item	q10-q14-1793446761696-b-tenant	q10-q14-1793446761696-b-invoice	q10-q14-1793446761696-b-product	q10-q14-1793446761696-b-batch	q10-q14-1793446761696-b-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 11:39:21.805
q10-q14-1793446761696-uncertain-item	q10-q14-1793446761696-uncertain-tenant	q10-q14-1793446761696-uncertain-invoice	q10-q14-1793446761696-uncertain-product	q10-q14-1793446761696-uncertain-batch	q10-q14-1793446761696-uncertain-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 11:39:21.875
q10-q14-1793446761696-rollback-item	q10-q14-1793446761696-rollback-tenant	q10-q14-1793446761696-rollback-invoice	q10-q14-1793446761696-rollback-product	q10-q14-1793446761696-rollback-batch	q10-q14-1793446761696-rollback-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 11:39:21.92
q10-q14-1793446761696-concurrent-item	q10-q14-1793446761696-concurrent-tenant	q10-q14-1793446761696-concurrent-invoice	q10-q14-1793446761696-concurrent-product	q10-q14-1793446761696-concurrent-batch	q10-q14-1793446761696-concurrent-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 11:39:21.948
q10-q14-1793446761696-conflicting-item	q10-q14-1793446761696-conflicting-tenant	q10-q14-1793446761696-conflicting-invoice	q10-q14-1793446761696-conflicting-product	q10-q14-1793446761696-conflicting-batch	q10-q14-1793446761696-conflicting-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 11:39:21.986
q10-app-1793447402381-item-0	q10-app-1793447402381-tenant	q10-app-1793447402381-invoice-0	q10-app-1793447402381-product	q10-app-1793447402381-batch	q10-app-1793447402381-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 11:50:02.383
q10-app-1793447402381-item-1	q10-app-1793447402381-tenant	q10-app-1793447402381-invoice-1	q10-app-1793447402381-product	q10-app-1793447402381-batch	q10-app-1793447402381-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 11:50:02.383
q10-app-1793447402381-item-2	q10-app-1793447402381-tenant	q10-app-1793447402381-invoice-2	q10-app-1793447402381-product	q10-app-1793447402381-batch	q10-app-1793447402381-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 11:50:02.383
q10-app-1793447603960-item-2	q10-app-1793447603960-tenant	q10-app-1793447603960-invoice-2	q10-app-1793447603960-product	q10-app-1793447603960-batch	q10-app-1793447603960-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 11:53:23.961
q10-app-1793447603960-item-0	q10-app-1793447603960-tenant	q10-app-1793447603960-invoice-0	q10-app-1793447603960-product	q10-app-1793447603960-batch	q10-app-1793447603960-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Q10 Application Product	\N	SYNTHETIC	2027-10-31 11:53:23.961	118.00	2026-10-31 11:53:23.961
q10-app-1793447603960-item-1	q10-app-1793447603960-tenant	q10-app-1793447603960-invoice-1	q10-app-1793447603960-product	q10-app-1793447603960-batch	q10-app-1793447603960-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Q10 Application Product	\N	SYNTHETIC	2027-10-31 11:53:23.961	118.00	2026-10-31 11:53:23.961
q10-q14-1793447682627-a-item	q10-q14-1793447682627-a-tenant	q10-q14-1793447682627-a-invoice	q10-q14-1793447682627-a-product	q10-q14-1793447682627-a-batch	q10-q14-1793447682627-a-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 11:54:42.698
q10-q14-1793447682627-b-item	q10-q14-1793447682627-b-tenant	q10-q14-1793447682627-b-invoice	q10-q14-1793447682627-b-product	q10-q14-1793447682627-b-batch	q10-q14-1793447682627-b-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 11:54:42.739
q10-q14-1793447682627-uncertain-item	q10-q14-1793447682627-uncertain-tenant	q10-q14-1793447682627-uncertain-invoice	q10-q14-1793447682627-uncertain-product	q10-q14-1793447682627-uncertain-batch	q10-q14-1793447682627-uncertain-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 11:54:42.819
q10-q14-1793447682627-rollback-item	q10-q14-1793447682627-rollback-tenant	q10-q14-1793447682627-rollback-invoice	q10-q14-1793447682627-rollback-product	q10-q14-1793447682627-rollback-batch	q10-q14-1793447682627-rollback-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 11:54:42.863
q10-q14-1793447682627-concurrent-item	q10-q14-1793447682627-concurrent-tenant	q10-q14-1793447682627-concurrent-invoice	q10-q14-1793447682627-concurrent-product	q10-q14-1793447682627-concurrent-batch	q10-q14-1793447682627-concurrent-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 11:54:42.897
q10-q14-1793447682627-conflicting-item	q10-q14-1793447682627-conflicting-tenant	q10-q14-1793447682627-conflicting-invoice	q10-q14-1793447682627-conflicting-product	q10-q14-1793447682627-conflicting-batch	q10-q14-1793447682627-conflicting-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 11:54:42.93
q10-app-1793452881250-item-2	q10-app-1793452881250-tenant	q10-app-1793452881250-invoice-2	q10-app-1793452881250-product	q10-app-1793452881250-batch	q10-app-1793452881250-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:21:21.252
q10-app-1793452881250-item-0	q10-app-1793452881250-tenant	q10-app-1793452881250-invoice-0	q10-app-1793452881250-product	q10-app-1793452881250-batch	q10-app-1793452881250-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Q10 Application Product	\N	SYNTHETIC	2027-10-31 13:21:21.252	118.00	2026-10-31 13:21:21.252
q10-app-1793452881250-item-1	q10-app-1793452881250-tenant	q10-app-1793452881250-invoice-1	q10-app-1793452881250-product	q10-app-1793452881250-batch	q10-app-1793452881250-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Q10 Application Product	\N	SYNTHETIC	2027-10-31 13:21:21.252	118.00	2026-10-31 13:21:21.252
q10-app-1793453149906-item-2	q10-app-1793453149906-tenant	q10-app-1793453149906-invoice-2	q10-app-1793453149906-product	q10-app-1793453149906-batch	q10-app-1793453149906-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:25:49.908
q10-app-1793453149906-item-0	q10-app-1793453149906-tenant	q10-app-1793453149906-invoice-0	q10-app-1793453149906-product	q10-app-1793453149906-batch	q10-app-1793453149906-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Q10 Application Product	\N	SYNTHETIC	2027-10-31 13:25:49.908	118.00	2026-10-31 13:25:49.908
q10-app-1793453149906-item-1	q10-app-1793453149906-tenant	q10-app-1793453149906-invoice-1	q10-app-1793453149906-product	q10-app-1793453149906-batch	q10-app-1793453149906-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Q10 Application Product	\N	SYNTHETIC	2027-10-31 13:25:49.908	118.00	2026-10-31 13:25:49.908
gst_e2e_sales_item_a_4508bb7b18324135a7a1e7a969974f93	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	gst_e2e_sales_0224b8038dc047f58231f9d3b25fcad3	gst_e2e_product_a_0e5f741a296b4af6ad4cf0270cd49f27	gst_e2e_batch_a_a2e8b6aae5c3475aa6611ec953be7fcb	A-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:29:28.512
gst_e2e_sales_item_b_89901c020da5467d9fc688994638d911	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	gst_e2e_sales_0224b8038dc047f58231f9d3b25fcad3	gst_e2e_product_b_38fb2ab9bb1a446b9c7476b42f8c2497	gst_e2e_batch_b_ff1062716630499f923f163ff17083c5	B-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:29:28.512
gst_e2e_sales_success_item_95a90f404f0144978174fc0b4cca40e0	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	gst_e2e_sales_success_3b4c635c1f2b4a2a84964299cff9a133	gst_e2e_product_a_0e5f741a296b4af6ad4cf0270cd49f27	gst_e2e_success_batch_428bf37e057949f19fe0e76702762439	SUCCESS-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:29:28.512
gst_e2e_sales_item_a_8c62d451861048c3b4fddc6ab854f09a	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_sales_1f58c7ce3d574ea3880febcff80b07b2	gst_e2e_product_a_dd647e0a44a04492b3ae5c7424277e1e	gst_e2e_batch_a_e9ace2b670154b6aa83ac95103282151	A-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:29:43.689
gst_e2e_sales_item_b_9de443adff3743d18ffe69080b697125	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_sales_1f58c7ce3d574ea3880febcff80b07b2	gst_e2e_product_b_86ef9cb4c46d43a5b69e2fa3322432b4	gst_e2e_batch_b_e350c92b9a634b2689bfb6e30ec7e5f9	B-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:29:43.689
gst_e2e_sales_success_item_2a5c5aea82bc474da0754cd5c035a9e2	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_sales_success_91524affce4b4b5cb5738c799d4a7f96	gst_e2e_product_a_dd647e0a44a04492b3ae5c7424277e1e	gst_e2e_success_batch_7941a22d2b7449be8c9087d594c31cff	SUCCESS-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:29:43.689
gst_e2e_snapshot_complete_item_7e3afb9bf56b40f9875a1b991be02784	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_snapshot_complete_invoice_0afbed6322ea4708a604b1a8f47ae5bb	gst_e2e_product_a_dd647e0a44a04492b3ae5c7424277e1e	gst_e2e_batch_a_e9ace2b670154b6aa83ac95103282151	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Original Product	Original Generic	3004	\N	118.00	2026-10-31 13:29:44.018
gst_e2e_snapshot_missing_item_4f052b3bd00048cf98faf0cd5bdde595	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	gst_e2e_snapshot_missing_invoice_6f0c45fdc5d44cd2a189aaa1bbc67355	gst_e2e_product_a_dd647e0a44a04492b3ae5c7424277e1e	gst_e2e_batch_a_e9ace2b670154b6aa83ac95103282151	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	\N	\N	3004	\N	118.00	2026-10-31 13:29:44.018
gst_e2e_sales_item_a_65ab6b662bbd40b1ad0114604a1dcf18	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_sales_b3a18f78406644b79f4dee3e61a84a0d	gst_e2e_product_a_98176164cbb747ef893682f89e6ec2a2	gst_e2e_batch_a_2a4344bb6b714a32a871d6a5a1796fb0	A-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:29:58.518
gst_e2e_sales_item_b_4e8e9590af07492f9c8349b735925891	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_sales_b3a18f78406644b79f4dee3e61a84a0d	gst_e2e_product_b_b430bdc432ce44328f05420a2315456e	gst_e2e_batch_b_041220c42ef1475cb83b73dfda2117f4	B-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:29:58.518
gst_e2e_sales_success_item_785740a7e3e64da8998566a456d846c1	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_sales_success_9047925573044ced9420a8dcd582d139	gst_e2e_product_a_98176164cbb747ef893682f89e6ec2a2	gst_e2e_success_batch_90f95efb63664388a514294608d87243	SUCCESS-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:29:58.518
gst_e2e_snapshot_complete_item_5ecb52a44d0b4e3c8c2002fd052f92d3	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_snapshot_complete_invoice_8a5b29f81e19487487f7487d73e3c909	gst_e2e_product_a_98176164cbb747ef893682f89e6ec2a2	gst_e2e_batch_a_2a4344bb6b714a32a871d6a5a1796fb0	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Original Product	Original Generic	3004	\N	118.00	2026-10-31 13:29:58.895
gst_e2e_snapshot_missing_item_42d42298dd4242e99ad2ab8a77f37e8a	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	gst_e2e_snapshot_missing_invoice_9a3d1f7ded5e47a99144a53fdf833480	gst_e2e_product_a_98176164cbb747ef893682f89e6ec2a2	gst_e2e_batch_a_2a4344bb6b714a32a871d6a5a1796fb0	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	\N	\N	3004	\N	118.00	2026-10-31 13:29:58.895
gst_e2e_sales_item_a_05ca7b8d22f646f5a2ccf740f488468e	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_sales_d8589bedeecf42a983de03783b4fef54	gst_e2e_product_a_85c96a47ac014220a91e997e63caf697	gst_e2e_batch_a_5a4a61c9d6db4f8592bff45ae46df37b	A-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:30:12.558
gst_e2e_sales_item_b_30cfd1cbb6584a8d81aeab7adb86b206	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_sales_d8589bedeecf42a983de03783b4fef54	gst_e2e_product_b_09897df5b6d64f0d90b2ce710fc7c4c0	gst_e2e_batch_b_e1b099862fda45aab950289b07193b35	B-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:30:12.558
gst_e2e_sales_success_item_1bcbf72587454ff5bd8300df59f137b0	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_sales_success_ca0b127b16784cc4a2751a71290edcc7	gst_e2e_product_a_85c96a47ac014220a91e997e63caf697	gst_e2e_success_batch_271f5864ddd44763bc79948edada5a4b	SUCCESS-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:30:12.558
gst_e2e_snapshot_complete_item_00313acc22d24c20a0a783a8919c7401	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_snapshot_complete_invoice_44382fd544fe40529c56e692ac2a4b8a	gst_e2e_product_a_85c96a47ac014220a91e997e63caf697	gst_e2e_batch_a_5a4a61c9d6db4f8592bff45ae46df37b	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Original Product	Original Generic	3004	\N	118.00	2026-10-31 13:30:12.923
gst_e2e_snapshot_missing_item_8f3585e641e943b99b5db9eebe649b3d	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	gst_e2e_snapshot_missing_invoice_6d17ed1c52484f2d9bac277b9ea0df12	gst_e2e_product_a_85c96a47ac014220a91e997e63caf697	gst_e2e_batch_a_5a4a61c9d6db4f8592bff45ae46df37b	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	\N	\N	3004	\N	118.00	2026-10-31 13:30:12.923
gst_e2e_sales_item_a_f3602ccf59784cf783b7053b6e2d642a	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_sales_3ad05948c38340078a5edc7a22ee32b0	gst_e2e_product_a_7b2e376947094939a8ff8015cc8f64f0	gst_e2e_batch_a_4cba84981d914f3b810d31def99480d0	A-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:31:24.678
gst_e2e_sales_item_b_4f7e7d89a9c843f5a74163b76a3b2b56	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_sales_3ad05948c38340078a5edc7a22ee32b0	gst_e2e_product_b_ae73613f1ed5432a83f76a3bf90924a6	gst_e2e_batch_b_7339e717c31f4159b339593399c43511	B-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:31:24.678
gst_e2e_sales_success_item_92687f7b76884d00a7421b86ed431d2a	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_sales_success_bb9300a6bcd54ccb88f63170232f7a54	gst_e2e_product_a_7b2e376947094939a8ff8015cc8f64f0	gst_e2e_success_batch_5098f684772b4902838800c765455f90	SUCCESS-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:31:24.678
gst_e2e_snapshot_complete_item_c47ed966768d4ccf9289aa03d85c8fc5	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_snapshot_complete_invoice_6b251db9ecc34f4c87c8f154e3ffb3e5	gst_e2e_product_a_7b2e376947094939a8ff8015cc8f64f0	gst_e2e_batch_a_4cba84981d914f3b810d31def99480d0	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Original Product	Original Generic	3004	\N	118.00	2026-10-31 13:31:24.884
gst_e2e_snapshot_missing_item_f83af5de88a145018bbfea90f6657f72	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	gst_e2e_snapshot_missing_invoice_b8c200d69dfc44388fdc21e5e2b83fbf	gst_e2e_product_a_7b2e376947094939a8ff8015cc8f64f0	gst_e2e_batch_a_4cba84981d914f3b810d31def99480d0	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	\N	\N	3004	\N	118.00	2026-10-31 13:31:24.884
gst_e2e_sales_item_a_300021d8a1f445cca083d758e8211809	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_sales_f3c798c4ac204e9fa72acda65b139826	gst_e2e_product_a_1734ed203ca1435e8582715750964b0d	gst_e2e_batch_a_7f0ebdf726714100818eeeb28ae29d42	A-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:32:42.82
gst_e2e_sales_item_b_4ad528278aa04e4a87be00122ad51c83	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_sales_f3c798c4ac204e9fa72acda65b139826	gst_e2e_product_b_ac2a8b0582324826ac0b91a516ac9480	gst_e2e_batch_b_966a4e9c4db041b0a6f3cf633f24cedd	B-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:32:42.82
gst_e2e_snapshot_complete_item_609d49a83c7849c1bc2c662b356aa358	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_snapshot_complete_invoice_5f6b36efd7364a589e051b78b5ac38f9	gst_e2e_product_a_1734ed203ca1435e8582715750964b0d	gst_e2e_batch_a_7f0ebdf726714100818eeeb28ae29d42	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Original Product	Original Generic	3004	\N	118.00	2026-10-31 13:32:43.044
gst_e2e_snapshot_missing_item_a8e79bcc0d3b47e9a1ae28cbf245a4d3	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_snapshot_missing_invoice_6db2df43c1c2489da1376e5ef60e2eda	gst_e2e_product_a_1734ed203ca1435e8582715750964b0d	gst_e2e_batch_a_7f0ebdf726714100818eeeb28ae29d42	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	\N	\N	3004	\N	118.00	2026-10-31 13:32:43.044
gst_e2e_sales_success_item_69c6f41a4e22456288f2f98236a7a30e	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_sales_success_c9722d460e8a47f6916e516454354bd4	gst_e2e_product_a_1734ed203ca1435e8582715750964b0d	gst_e2e_success_batch_e60ca2e948194b59bae7d76cda6b13a9	SUCCESS-1	1	0	100.00	\N	\N	0.00	100.00	18.00	0.00	9.00	9.00	0.00	0.00	GST Product A	GST Product A Generic	3004	\N	118.00	2026-10-31 13:32:42.82
gst_e2e_sales_item_a_3f4994308b684e3b81d72d869933fca4	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_sales_0400c2a8a2f4485387990039ed2bbf2c	gst_e2e_product_a_fdf4a40153c5437a9ecb579368dedc61	gst_e2e_batch_a_8d53732f280d48a3aa1987840e67dfe8	A-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:33:55.958
gst_e2e_sales_item_b_b536f90a76b44f1c9cee6d20933a113d	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_sales_0400c2a8a2f4485387990039ed2bbf2c	gst_e2e_product_b_9b2a31989304458583642fbabdad37e6	gst_e2e_batch_b_e12e0cca73614f8e817d0f69a813180c	B-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:33:55.958
gst_e2e_snapshot_complete_item_b41d002772b8431899c43340fb5238f1	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_snapshot_complete_invoice_06dea3e83ad140ebaf5cd291dc55f049	gst_e2e_product_a_fdf4a40153c5437a9ecb579368dedc61	gst_e2e_batch_a_8d53732f280d48a3aa1987840e67dfe8	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Original Product	Original Generic	3004	\N	118.00	2026-10-31 13:33:56.19
gst_e2e_snapshot_missing_item_5be50cbb667b4798b31e5e4bd535c1a0	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_snapshot_missing_invoice_fa9440f5ebc54a37a2a4bb7b9b29432f	gst_e2e_product_a_fdf4a40153c5437a9ecb579368dedc61	gst_e2e_batch_a_8d53732f280d48a3aa1987840e67dfe8	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	\N	\N	3004	\N	118.00	2026-10-31 13:33:56.19
gst_e2e_sales_success_item_f22dcfc9df00405083b551aabf483a58	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_sales_success_afdbc6d5a3564cca92e3383e1fbd7e74	gst_e2e_product_a_30bbee97d538445f8ca1dcf448323e54	gst_e2e_success_batch_8bb785415e724773a40c93907a3b3500	SUCCESS-1	1	0	100.00	\N	\N	0.00	100.00	18.00	0.00	9.00	9.00	0.00	0.00	GST Product A	GST Product A Generic	3004	\N	118.00	2026-10-31 13:35:09.31
gst_e2e_sales_success_item_972e0500148947fc926a924361451da2	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_sales_success_0708541c7aef4e43a298df5fa0fa77e1	gst_e2e_product_a_fdf4a40153c5437a9ecb579368dedc61	gst_e2e_success_batch_f5a5ec9dfe2c49bab31274bd1882f83a	SUCCESS-1	1	0	100.00	\N	\N	0.00	100.00	18.00	0.00	9.00	9.00	0.00	0.00	GST Product A	GST Product A Generic	3004	\N	118.00	2026-10-31 13:33:55.958
gst_e2e_sales_item_a_35a9d53089374b1983e40332c7a09dcc	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_sales_d4cb11dafc5043418ebb1b4b58f9972f	gst_e2e_product_a_30bbee97d538445f8ca1dcf448323e54	gst_e2e_batch_a_4e3d69037d3c45adb857a9ddf01dcdd6	A-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:35:09.31
gst_e2e_sales_item_b_27ba32a07fb647549c589652a1970e1a	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_sales_d4cb11dafc5043418ebb1b4b58f9972f	gst_e2e_product_b_3a13466a6dec4e50b2620ed9f0d19564	gst_e2e_batch_b_0ee6a1d99d664ad69ba03bb5b1a7f99e	B-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:35:09.31
gst_e2e_snapshot_complete_item_634b699cb6c54cbaa8d7a2947e46fd3e	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_snapshot_complete_invoice_50d7c7bade754197b725c87b9aac37bc	gst_e2e_product_a_30bbee97d538445f8ca1dcf448323e54	gst_e2e_batch_a_4e3d69037d3c45adb857a9ddf01dcdd6	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Original Product	Original Generic	3004	\N	118.00	2026-10-31 13:35:09.503
gst_e2e_snapshot_missing_item_05af2c3d39254eaf95c6a1b2a2bc2853	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_snapshot_missing_invoice_2a1e3958dcf94b4393517f7db81235a0	gst_e2e_product_a_30bbee97d538445f8ca1dcf448323e54	gst_e2e_batch_a_4e3d69037d3c45adb857a9ddf01dcdd6	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	\N	\N	3004	\N	118.00	2026-10-31 13:35:09.503
gst_e2e_sales_item_a_9750a391cf694685ab2d12300eec78c3	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_sales_5a2bfbea13744d2f94bb1966a501e87b	gst_e2e_product_a_85f2971d05db4af59a4e72f1bcd81079	gst_e2e_batch_a_055b24662b594ebbaad6796af3c631d3	A-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:36:28.408
gst_e2e_sales_item_b_edfc9f92824a424fa81c7a57a10a4680	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_sales_5a2bfbea13744d2f94bb1966a501e87b	gst_e2e_product_b_51b5694b5fed4ce4af0d7a34685c9e71	gst_e2e_batch_b_f66989f768b84079b5b3d152bc74a95a	B-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:36:28.408
gst_e2e_snapshot_complete_item_75d95fa007aa4ba89d0acb7fb5937082	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_snapshot_complete_invoice_906240a62b804cb28b103c76fd7b3310	gst_e2e_product_a_85f2971d05db4af59a4e72f1bcd81079	gst_e2e_batch_a_055b24662b594ebbaad6796af3c631d3	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Original Product	Original Generic	3004	\N	118.00	2026-10-31 13:36:28.667
gst_e2e_snapshot_missing_item_3f39c7dae11840018c6fb552883ee97a	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_snapshot_missing_invoice_c8123e251e9040bc828940787b7f64f6	gst_e2e_product_a_85f2971d05db4af59a4e72f1bcd81079	gst_e2e_batch_a_055b24662b594ebbaad6796af3c631d3	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	\N	\N	3004	\N	118.00	2026-10-31 13:36:28.667
gst_e2e_sales_success_item_f9721bed032b4cfcbb4013f1c3c5e446	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_sales_success_4c9c04755904459bba454f3edc4a0120	gst_e2e_product_a_85f2971d05db4af59a4e72f1bcd81079	gst_e2e_success_batch_121719be72b24b109f688b7e5c453d22	SUCCESS-1	1	0	100.00	\N	\N	0.00	100.00	18.00	0.00	9.00	9.00	0.00	0.00	GST Product A	GST Product A Generic	3004	\N	118.00	2026-10-31 13:36:28.408
gst_e2e_sales_item_a_3a874c2b51d147759e55c1e215461f40	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_sales_5d6669564f7c4aceac7a838c3e447363	gst_e2e_product_a_799cb53d442f4628a904adc8b69291aa	gst_e2e_batch_a_bfebe928dd1942f5a8218a899c782443	A-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:37:50.384
gst_e2e_sales_item_b_c96ac87625d14e3ba92b55592bdc4a73	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_sales_5d6669564f7c4aceac7a838c3e447363	gst_e2e_product_b_7bfcd52cab084c1fab273c357ded03b7	gst_e2e_batch_b_e2fc2dbbfd5444079ffbd9d6330bfb56	B-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:37:50.384
gst_e2e_snapshot_complete_item_03b2674aa1b84a928c409a4a98993417	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_snapshot_complete_invoice_ac7bce2f8c0c47d08e55d57f6ae90349	gst_e2e_product_a_799cb53d442f4628a904adc8b69291aa	gst_e2e_batch_a_bfebe928dd1942f5a8218a899c782443	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Original Product	Original Generic	3004	\N	118.00	2026-10-31 13:37:50.587
gst_e2e_snapshot_missing_item_ba65e6ffd02d4d4e9b5b9cd83ef2b6d4	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_snapshot_missing_invoice_38515b03cb664971b608b293057e4e3a	gst_e2e_product_a_799cb53d442f4628a904adc8b69291aa	gst_e2e_batch_a_bfebe928dd1942f5a8218a899c782443	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	\N	\N	3004	\N	118.00	2026-10-31 13:37:50.587
gst_e2e_sales_success_item_b440e64e6d21427786d461f038749699	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_sales_success_9e5c4bd6a06442659dae4570dd904250	gst_e2e_product_a_7473b483cbdd42bb9b764d186206acd7	gst_e2e_success_batch_8440d4c3a39149bc9acd36a8ca06f009	SUCCESS-1	1	0	100.00	\N	\N	0.00	100.00	18.00	0.00	9.00	9.00	0.00	0.00	GST Product A	GST Product A Generic	3004	\N	118.00	2026-10-31 13:39:14.029
gst_e2e_sales_success_item_ffdd8aa8901c46af95e2bb98e7a6733e	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_sales_success_76727966456547758e6f567b024f8d91	gst_e2e_product_a_799cb53d442f4628a904adc8b69291aa	gst_e2e_success_batch_342292d72f8e4cc4b05d8cae11708c2b	SUCCESS-1	1	0	100.00	\N	\N	0.00	100.00	18.00	0.00	9.00	9.00	0.00	0.00	GST Product A	GST Product A Generic	3004	\N	118.00	2026-10-31 13:37:50.384
gst_e2e_sales_item_a_1e0f0bf69ee9492e8dfcecf37056c007	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_sales_0f015bc8a646486494b049de22f68888	gst_e2e_product_a_7473b483cbdd42bb9b764d186206acd7	gst_e2e_batch_a_0d21bfc815624b91bc873ec459211eb4	A-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:39:14.029
gst_e2e_sales_item_b_280676a9b4a3458eaa84ec55d7bf18d8	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_sales_0f015bc8a646486494b049de22f68888	gst_e2e_product_b_9ec21ef95cec49baa32ddb5e1725fc28	gst_e2e_batch_b_af7e39e45b46467f863700487826e8ab	B-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:39:14.029
gst_e2e_snapshot_complete_item_fdde28032c0c4c9cbae9e80164574a07	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_snapshot_complete_invoice_97be5a402a4546c4ad618640dcd83fb8	gst_e2e_product_a_7473b483cbdd42bb9b764d186206acd7	gst_e2e_batch_a_0d21bfc815624b91bc873ec459211eb4	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Original Product	Original Generic	3004	\N	118.00	2026-10-31 13:39:14.195
gst_e2e_snapshot_missing_item_55c6098e7a2c4c0e85e37dc1c5bad298	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_snapshot_missing_invoice_2f3c9293f7cf4b8a9d12fe9c0b4c3ed6	gst_e2e_product_a_7473b483cbdd42bb9b764d186206acd7	gst_e2e_batch_a_0d21bfc815624b91bc873ec459211eb4	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	\N	\N	3004	\N	118.00	2026-10-31 13:39:14.195
gst_e2e_sales_item_a_179981fb0fd640a8a861fe060523659d	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_sales_f8e37dd2033b49c3aab38134d02e47d1	gst_e2e_product_a_ae05cfb72eaa42aabcc0996a8359d276	gst_e2e_batch_a_5e7293740c3d4610959494eb1f4ff8ca	A-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:40:27.581
gst_e2e_sales_item_b_a69a289c30554287a0bc3ca554422e5f	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_sales_f8e37dd2033b49c3aab38134d02e47d1	gst_e2e_product_b_c4870b96d1774df68844834792a2783e	gst_e2e_batch_b_87d52e428e94421b9b7d66d582716163	B-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:40:27.581
gst_e2e_snapshot_complete_item_60fd16ffd6fe40c7aac8cde2527e2f54	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_snapshot_complete_invoice_de9ac7fddbe34e378e5ca24700354072	gst_e2e_product_a_ae05cfb72eaa42aabcc0996a8359d276	gst_e2e_batch_a_5e7293740c3d4610959494eb1f4ff8ca	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Original Product	Original Generic	3004	\N	118.00	2026-10-31 13:40:27.768
gst_e2e_snapshot_missing_item_9f78b04c5f994670af705eb860890ab9	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_snapshot_missing_invoice_8180c19b43db4e75ae708ad113523b43	gst_e2e_product_a_ae05cfb72eaa42aabcc0996a8359d276	gst_e2e_batch_a_5e7293740c3d4610959494eb1f4ff8ca	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	\N	\N	3004	\N	118.00	2026-10-31 13:40:27.768
gst_e2e_sales_success_item_f32879af63b84681938c609984643097	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_sales_success_861a943099ab401896b2cf2663424588	gst_e2e_product_a_ae05cfb72eaa42aabcc0996a8359d276	gst_e2e_success_batch_3f6e084c37b64f6ab8e0137e3e1c20f4	SUCCESS-1	1	0	100.00	\N	\N	0.00	100.00	18.00	0.00	9.00	9.00	0.00	0.00	GST Product A	GST Product A Generic	3004	\N	118.00	2026-10-31 13:40:27.581
gst_e2e_sales_item_a_c3cf8754a1824b01a9fc8df3c1a580e0	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_sales_69d4bbdb1a9645688a607babf878a140	gst_e2e_product_a_c5b641f60f2b47f78bedf11520bf4bf8	gst_e2e_batch_a_2079e4168b6644e483d0ccb93a2cea38	A-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:41:41.091
gst_e2e_sales_item_b_af827cbf4558489794d138bac0e0c80a	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_sales_69d4bbdb1a9645688a607babf878a140	gst_e2e_product_b_e4d26bf6051e4c3c87bee38273d433f0	gst_e2e_batch_b_3607aab0addc4656b5eeee3c6aebbf51	B-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:41:41.091
gst_e2e_snapshot_complete_item_4c2db18e41024848aed40a00941f5762	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_snapshot_complete_invoice_b1e9a8689228467692483c186f60a4ba	gst_e2e_product_a_c5b641f60f2b47f78bedf11520bf4bf8	gst_e2e_batch_a_2079e4168b6644e483d0ccb93a2cea38	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Original Product	Original Generic	3004	\N	118.00	2026-10-31 13:41:41.313
gst_e2e_snapshot_missing_item_3e857eeb2c54477f92d8f17c49f1dc44	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_snapshot_missing_invoice_3d26ae364d634abc93ce19e332609a78	gst_e2e_product_a_c5b641f60f2b47f78bedf11520bf4bf8	gst_e2e_batch_a_2079e4168b6644e483d0ccb93a2cea38	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	\N	\N	3004	\N	118.00	2026-10-31 13:41:41.313
gst_e2e_sales_success_item_655ced3dbd1e4728b5a95cf03417e04c	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_sales_success_b3d1b8d7803746e8a34a24ada270c41d	gst_e2e_product_a_90580835eb21424b947a18e5b7a00cf0	gst_e2e_success_batch_2f3674f3f91748f6902210a5cfef1aad	SUCCESS-1	1	0	100.00	\N	\N	0.00	100.00	18.00	0.00	9.00	9.00	0.00	0.00	GST Product A	GST Product A Generic	3004	\N	118.00	2026-10-31 13:42:54.027
gst_e2e_sales_success_item_bee879f2a65e43ddbc15f5714d31e01d	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_sales_success_ad360a6411064d099a18d08fa4bf62c4	gst_e2e_product_a_c5b641f60f2b47f78bedf11520bf4bf8	gst_e2e_success_batch_ad33f9b7b64142d48c4030ffde4557e8	SUCCESS-1	1	0	100.00	\N	\N	0.00	100.00	18.00	0.00	9.00	9.00	0.00	0.00	GST Product A	GST Product A Generic	3004	\N	118.00	2026-10-31 13:41:41.091
gst_e2e_sales_item_a_ab1dad19cf7e459cb4962f54af8cbefd	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_sales_a482ade43cfb45bbb9be7345c77aeb9a	gst_e2e_product_a_90580835eb21424b947a18e5b7a00cf0	gst_e2e_batch_a_2655efbb72c642a28d13d5b546923cb4	A-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:42:54.027
gst_e2e_sales_item_b_35a294c8ed5a43d8890338bd2ab72f21	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_sales_a482ade43cfb45bbb9be7345c77aeb9a	gst_e2e_product_b_b2c16c8e2ae6497c90861fc61c9ac163	gst_e2e_batch_b_66bdbda9c3ef4428b84df4ebef44fc43	B-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:42:54.027
gst_e2e_snapshot_complete_item_bffc7b3470d142f7b9f064c00aa3006a	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_snapshot_complete_invoice_f31c83c6eaaf48fea4e7a7b491243c2d	gst_e2e_product_a_90580835eb21424b947a18e5b7a00cf0	gst_e2e_batch_a_2655efbb72c642a28d13d5b546923cb4	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Original Product	Original Generic	3004	\N	118.00	2026-10-31 13:42:54.23
gst_e2e_snapshot_missing_item_78fa72185d674836a3226d988c3dab47	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_snapshot_missing_invoice_793a9074ae174635b446c44527e2b42e	gst_e2e_product_a_90580835eb21424b947a18e5b7a00cf0	gst_e2e_batch_a_2655efbb72c642a28d13d5b546923cb4	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	\N	\N	3004	\N	118.00	2026-10-31 13:42:54.23
gst_e2e_sales_item_a_d3b0dbd33ef24ea7804468e72b60ff62	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_sales_bcf79b8efa1e442ea929e70aef397081	gst_e2e_product_a_f2815984af604069a7e49a67c2a505ec	gst_e2e_batch_a_abd9959e4d974a6b8d27f59e65d46f46	A-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:44:31.539
gst_e2e_sales_item_b_e2de5f5952d545d1a4444bc3aabe98a0	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_sales_bcf79b8efa1e442ea929e70aef397081	gst_e2e_product_b_a19da0991c634e3b9c9c424eefe6eb04	gst_e2e_batch_b_c2a2fa40ba514406ac6dd4b0b329c4cc	B-1	1	0	100.00	\N	\N	0.00	\N	18.00	0.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:44:31.539
gst_e2e_snapshot_complete_item_c9f02330bf154142b716e51fc6828bff	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_snapshot_complete_invoice_bdb57a67bfbc4b03957b052e44dc6855	gst_e2e_product_a_f2815984af604069a7e49a67c2a505ec	gst_e2e_batch_a_abd9959e4d974a6b8d27f59e65d46f46	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Original Product	Original Generic	3004	\N	118.00	2026-10-31 13:44:31.776
gst_e2e_snapshot_missing_item_976704422a8c4e82b573cb51c07e5024	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_snapshot_missing_invoice_65bda4b0c53345818ba95a372b8f5040	gst_e2e_product_a_f2815984af604069a7e49a67c2a505ec	gst_e2e_batch_a_abd9959e4d974a6b8d27f59e65d46f46	SNAP-1	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	\N	\N	3004	\N	118.00	2026-10-31 13:44:31.776
q10-app-1793460716221-item-0	q10-app-1793460716221-tenant	q10-app-1793460716221-invoice-0	q10-app-1793460716221-product	q10-app-1793460716221-batch	q10-app-1793460716221-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 15:31:56.222
q10-app-1793460716221-item-1	q10-app-1793460716221-tenant	q10-app-1793460716221-invoice-1	q10-app-1793460716221-product	q10-app-1793460716221-batch	q10-app-1793460716221-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 15:31:56.222
gst_e2e_sales_success_item_5129bf91fcba43cc8f03a7b98612705e	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_sales_success_e95ec457a9c74f97be29242a8011148c	gst_e2e_product_a_f2815984af604069a7e49a67c2a505ec	gst_e2e_success_batch_ce39cd9ae2b74cffa21bc660afe91dea	SUCCESS-1	1	0	100.00	\N	\N	0.00	100.00	18.00	0.00	9.00	9.00	0.00	0.00	GST Product A	GST Product A Generic	3004	\N	118.00	2026-10-31 13:44:31.539
q10-app-1793454341866-item-2	q10-app-1793454341866-tenant	q10-app-1793454341866-invoice-2	q10-app-1793454341866-product	q10-app-1793454341866-batch	q10-app-1793454341866-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:45:41.869
q10-app-1793454341866-item-0	q10-app-1793454341866-tenant	q10-app-1793454341866-invoice-0	q10-app-1793454341866-product	q10-app-1793454341866-batch	q10-app-1793454341866-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Q10 Application Product	\N	SYNTHETIC	2027-10-31 13:45:41.869	118.00	2026-10-31 13:45:41.869
q10-app-1793454341866-item-1	q10-app-1793454341866-tenant	q10-app-1793454341866-invoice-1	q10-app-1793454341866-product	q10-app-1793454341866-batch	q10-app-1793454341866-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Q10 Application Product	\N	SYNTHETIC	2027-10-31 13:45:41.869	118.00	2026-10-31 13:45:41.869
q10-app-1793454409161-item-2	q10-app-1793454409161-tenant	q10-app-1793454409161-invoice-2	q10-app-1793454409161-product	q10-app-1793454409161-batch	q10-app-1793454409161-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:46:49.162
q10-app-1793454409161-item-0	q10-app-1793454409161-tenant	q10-app-1793454409161-invoice-0	q10-app-1793454409161-product	q10-app-1793454409161-batch	q10-app-1793454409161-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Q10 Application Product	\N	SYNTHETIC	2027-10-31 13:46:49.162	118.00	2026-10-31 13:46:49.162
q10-app-1793454409161-item-1	q10-app-1793454409161-tenant	q10-app-1793454409161-invoice-1	q10-app-1793454409161-product	q10-app-1793454409161-batch	q10-app-1793454409161-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Q10 Application Product	\N	SYNTHETIC	2027-10-31 13:46:49.162	118.00	2026-10-31 13:46:49.162
q10-app-1793454491946-item-2	q10-app-1793454491946-tenant	q10-app-1793454491946-invoice-2	q10-app-1793454491946-product	q10-app-1793454491946-batch	q10-app-1793454491946-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 13:48:11.948
q10-app-1793454491946-item-0	q10-app-1793454491946-tenant	q10-app-1793454491946-invoice-0	q10-app-1793454491946-product	q10-app-1793454491946-batch	q10-app-1793454491946-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Q10 Application Product	\N	SYNTHETIC	2027-10-31 13:48:11.948	118.00	2026-10-31 13:48:11.948
q10-app-1793454491946-item-1	q10-app-1793454491946-tenant	q10-app-1793454491946-invoice-1	q10-app-1793454491946-product	q10-app-1793454491946-batch	q10-app-1793454491946-batch	1	0	100.00	\N	\N	0.00	100.00	18.00	18.00	9.00	9.00	0.00	0.00	Q10 Application Product	\N	SYNTHETIC	2027-10-31 13:48:11.948	118.00	2026-10-31 13:48:11.948
q10-app-1793460716221-item-2	q10-app-1793460716221-tenant	q10-app-1793460716221-invoice-2	q10-app-1793460716221-product	q10-app-1793460716221-batch	q10-app-1793460716221-batch	1	0	100.00	\N	\N	0.00	\N	18.00	18.00	\N	\N	\N	\N	\N	\N	\N	\N	118.00	2026-10-31 15:31:56.222
\.


--
-- Data for Name: sales_invoices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sales_invoices (id, tenant_id, invoice_no, customer_id, invoice_date, status, tax_data_status, place_of_supply_code, is_cash_sale, gross_amount, total_discount, total_tax, round_off, net_amount, paid_amount, balance_due, payment_mode, notes, created_by, finalized_at, cancelled_at, cancelled_by, cancel_reason, seller_name_snapshot, seller_address_line_1_snapshot, seller_address_line_2_snapshot, seller_city_snapshot, seller_state_snapshot, seller_pincode_snapshot, seller_gstin_snapshot, customer_name_snapshot, customer_address_line_1_snapshot, customer_address_line_2_snapshot, customer_city_snapshot, customer_state_snapshot, customer_pincode_snapshot, customer_gstin_snapshot, created_at, updated_at) FROM stdin;
q10-q14-1793420207911-a-invoice	q10-q14-1793420207911-a-tenant	q10-q14-1793420207911-a-draft	q10-q14-1793420207911-a-customer	2026-10-31 04:16:47.969	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793420207911-a-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:16:47.969	2026-10-31 04:16:47.969
q10-q14-1793420207911-b-invoice	q10-q14-1793420207911-b-tenant	q10-q14-1793420207911-b-draft	q10-q14-1793420207911-b-customer	2026-10-31 04:16:48.008	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793420207911-b-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:16:48.008	2026-10-31 04:16:48.008
q10-q14-1793420214519-a-invoice	q10-q14-1793420214519-a-tenant	q10-q14-1793420214519-a-draft	q10-q14-1793420214519-a-customer	2026-10-31 04:16:54.574	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793420214519-a-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:16:54.574	2026-10-31 04:16:54.574
q10-q14-1793420214519-b-invoice	q10-q14-1793420214519-b-tenant	q10-q14-1793420214519-b-draft	q10-q14-1793420214519-b-customer	2026-10-31 04:16:54.615	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793420214519-b-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:16:54.615	2026-10-31 04:16:54.615
q10-q14-1793420220210-b-invoice	q10-q14-1793420220210-b-tenant	q10-q14-1793420220210-b-draft	q10-q14-1793420220210-b-customer	2026-10-31 04:17:00.306	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793420220210-b-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:17:00.306	2026-10-31 04:17:00.306
q10-q14-1793420220210-a-invoice	q10-q14-1793420220210-a-tenant	q10-q14-1793420220210-10-a-invoice	q10-q14-1793420220210-a-customer	2026-10-31 04:17:00.268	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793420220210-a-user	2026-10-31 04:17:00.344	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:17:00.268	2026-10-31 04:17:00.344
q10-q14-1793420220210-rollback-invoice	q10-q14-1793420220210-rollback-tenant	q10-q14-1793420220210-rollback-draft	q10-q14-1793420220210-rollback-customer	2026-10-31 04:17:00.393	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793420220210-rollback-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:17:00.393	2026-10-31 04:17:00.393
q10-q14-1793420220210-concurrent-invoice	q10-q14-1793420220210-concurrent-tenant	q10-q14-1793420220210-rent-invoice	q10-q14-1793420220210-concurrent-customer	2026-10-31 04:17:00.434	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793420220210-concurrent-user	2026-10-31 04:17:00.46	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:17:00.434	2026-10-31 04:17:00.46
q10-q14-1793420348045-a-invoice	q10-q14-1793420348045-a-tenant	q10-q14-1793420348045-a-draft	q10-q14-1793420348045-a-customer	2026-10-31 04:19:08.093	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793420348045-a-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:19:08.093	2026-10-31 04:19:08.093
q10-q14-1793420348045-b-invoice	q10-q14-1793420348045-b-tenant	q10-q14-1793420348045-b-draft	q10-q14-1793420348045-b-customer	2026-10-31 04:19:08.125	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793420348045-b-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:19:08.125	2026-10-31 04:19:08.125
q10-q14-1793420355327-b-invoice	q10-q14-1793420355327-b-tenant	q10-q14-1793420355327-b-draft	q10-q14-1793420355327-b-customer	2026-10-31 04:19:15.409	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793420355327-b-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:19:15.409	2026-10-31 04:19:15.409
q10-q14-1793420355327-a-invoice	q10-q14-1793420355327-a-tenant	q10-q14-1793420355327-27-a-invoice	q10-q14-1793420355327-a-customer	2026-10-31 04:19:15.377	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793420355327-a-user	2026-10-31 04:19:15.443	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:19:15.377	2026-10-31 04:19:15.443
q10-q14-1793420355327-uncertain-invoice	q10-q14-1793420355327-uncertain-tenant	q10-q14-1793420355327-tain-invoice	q10-q14-1793420355327-uncertain-customer	2026-10-31 04:19:15.469	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793420355327-uncertain-user	2026-10-31 04:19:15.485	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:19:15.469	2026-10-31 04:19:15.485
q10-q14-1793420355327-rollback-invoice	q10-q14-1793420355327-rollback-tenant	q10-q14-1793420355327-rollback-draft	q10-q14-1793420355327-rollback-customer	2026-10-31 04:19:15.508	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793420355327-rollback-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:19:15.508	2026-10-31 04:19:15.508
q10-q14-1793420355327-concurrent-invoice	q10-q14-1793420355327-concurrent-tenant	q10-q14-1793420355327-rent-invoice	q10-q14-1793420355327-concurrent-customer	2026-10-31 04:19:15.538	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793420355327-concurrent-user	2026-10-31 04:19:15.557	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:19:15.538	2026-10-31 04:19:15.557
q10-q14-1793420355327-conflicting-invoice	q10-q14-1793420355327-conflicting-tenant	q10-q14-1793420355327-ting-invoice	q10-q14-1793420355327-conflicting-customer	2026-10-31 04:19:15.573	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793420355327-conflicting-user	2026-10-31 04:19:15.591	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:19:15.573	2026-10-31 04:19:15.591
q10-q14-1793421051032-a-invoice	q10-q14-1793421051032-a-tenant	q10-q14-1793421051032-32-a-invoice	q10-q14-1793421051032-a-customer	2026-10-31 04:30:51.126	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421051032-a-user	2026-10-31 04:30:51.303	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:30:51.126	2026-10-31 04:30:51.303
q10-q14-1793421051032-uncertain-invoice	q10-q14-1793421051032-uncertain-tenant	q10-q14-1793421051032-tain-invoice	q10-q14-1793421051032-uncertain-customer	2026-10-31 04:30:51.365	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421051032-uncertain-user	2026-10-31 04:30:51.411	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:30:51.365	2026-10-31 04:30:51.411
q10-q14-1793421051032-concurrent-invoice	q10-q14-1793421051032-concurrent-tenant	q10-q14-1793421051032-rent-invoice	q10-q14-1793421051032-concurrent-customer	2026-10-31 04:30:51.534	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421051032-concurrent-user	2026-10-31 04:30:51.574	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:30:51.534	2026-10-31 04:30:51.574
q10-q14-1793421051032-conflicting-invoice	q10-q14-1793421051032-conflicting-tenant	q10-q14-1793421051032-ting-invoice	q10-q14-1793421051032-conflicting-customer	2026-10-31 04:30:51.605	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421051032-conflicting-user	2026-10-31 04:30:51.639	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:30:51.605	2026-10-31 04:30:51.639
q10-q14-1793421102644-a-invoice	q10-q14-1793421102644-a-tenant	q10-q14-1793421102644-44-a-invoice	q10-q14-1793421102644-a-customer	2026-10-31 04:31:42.721	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421102644-a-user	2026-10-31 04:31:42.794	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:31:42.721	2026-10-31 04:31:42.794
q10-q14-1793421102644-uncertain-invoice	q10-q14-1793421102644-uncertain-tenant	q10-q14-1793421102644-tain-invoice	q10-q14-1793421102644-uncertain-customer	2026-10-31 04:31:42.822	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421102644-uncertain-user	2026-10-31 04:31:42.839	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:31:42.822	2026-10-31 04:31:42.839
q10-q14-1793421102644-concurrent-invoice	q10-q14-1793421102644-concurrent-tenant	q10-q14-1793421102644-rent-invoice	q10-q14-1793421102644-concurrent-customer	2026-10-31 04:31:42.892	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421102644-concurrent-user	2026-10-31 04:31:42.912	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:31:42.892	2026-10-31 04:31:42.912
q10-q14-1793421102644-rollback-invoice	q10-q14-1793421102644-rollback-tenant	q10-q14-1793421102644-rollback-draft	q10-q14-1793421102644-rollback-customer	2026-10-31 04:31:42.862	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421102644-rollback-user	2026-10-31 04:42:16.135	\N	\N	\N	Synthetic rollback	\N	\N	\N	MH	\N	\N	Synthetic Customer rollback	\N	\N	\N	MH	\N	\N	2026-10-31 04:31:42.862	2026-10-31 04:42:16.135
q10-q14-1793421102644-b-invoice	q10-q14-1793421102644-b-tenant	q10-q14-1793421102644-b-draft	q10-q14-1793421102644-b-customer	2026-10-31 04:31:42.753	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421102644-b-user	2026-10-31 04:42:16.219	\N	\N	\N	Synthetic b	\N	\N	\N	MH	\N	\N	Synthetic Customer b	\N	\N	\N	MH	\N	\N	2026-10-31 04:31:42.753	2026-10-31 04:42:16.219
q10-q14-1793421051032-b-invoice	q10-q14-1793421051032-b-tenant	q10-q14-1793421051032-b-draft	q10-q14-1793421051032-b-customer	2026-10-31 04:30:51.203	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421051032-b-user	2026-10-31 04:44:28.09	\N	\N	\N	Synthetic b	\N	\N	\N	MH	\N	\N	Synthetic Customer b	\N	\N	\N	MH	\N	\N	2026-10-31 04:30:51.203	2026-10-31 04:44:28.09
q10-app-1793446286377-invoice-2	q10-app-1793446286377-tenant	q10-app-1793446286377-draft-2	q10-app-1793446286377-customer	2026-10-31 11:31:26.379	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793446286377-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 11:31:26.379	2026-10-31 11:31:26.379
q10-q14-1793421102644-conflicting-invoice	q10-q14-1793421102644-conflicting-tenant	q10-q14-1793421102644-ting-invoice	q10-q14-1793421102644-conflicting-customer	2026-10-31 04:31:42.928	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421102644-conflicting-user	2026-10-31 04:31:42.946	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:31:42.928	2026-10-31 04:31:42.946
q10-q14-1793421202430-a-invoice	q10-q14-1793421202430-a-tenant	q10-q14-1793421202430-30-a-invoice	q10-q14-1793421202430-a-customer	2026-10-31 04:33:22.534	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421202430-a-user	2026-10-31 04:33:22.648	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:33:22.534	2026-10-31 04:33:22.648
q10-q14-1793421202430-uncertain-invoice	q10-q14-1793421202430-uncertain-tenant	q10-q14-1793421202430-tain-invoice	q10-q14-1793421202430-uncertain-customer	2026-10-31 04:33:22.696	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421202430-uncertain-user	2026-10-31 04:33:22.728	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:33:22.696	2026-10-31 04:33:22.728
q10-q14-1793421202430-concurrent-invoice	q10-q14-1793421202430-concurrent-tenant	q10-q14-1793421202430-rent-invoice	q10-q14-1793421202430-concurrent-customer	2026-10-31 04:33:22.819	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421202430-concurrent-user	2026-10-31 04:33:22.85	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:33:22.819	2026-10-31 04:33:22.85
q10-q14-1793421202430-conflicting-invoice	q10-q14-1793421202430-conflicting-tenant	q10-q14-1793421202430-ting-invoice	q10-q14-1793421202430-conflicting-customer	2026-10-31 04:33:22.877	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421202430-conflicting-user	2026-10-31 04:33:22.906	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:33:22.877	2026-10-31 04:33:22.906
q10-q14-1793421202430-rollback-invoice	q10-q14-1793421202430-rollback-tenant	q10-q14-1793421202430-rollback-draft	q10-q14-1793421202430-rollback-customer	2026-10-31 04:33:22.771	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421202430-rollback-user	2026-10-31 04:36:31.799	\N	\N	\N	Synthetic rollback	\N	\N	\N	MH	\N	\N	Synthetic Customer rollback	\N	\N	\N	MH	\N	\N	2026-10-31 04:33:22.771	2026-10-31 04:36:31.799
q10-q14-1793421457888-a-invoice	q10-q14-1793421457888-a-tenant	q10-q14-1793421457888-88-a-invoice	q10-q14-1793421457888-a-customer	2026-10-31 04:37:37.984	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421457888-a-user	2026-10-31 04:37:38.059	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:37:37.984	2026-10-31 04:37:38.059
q10-q14-1793421457888-uncertain-invoice	q10-q14-1793421457888-uncertain-tenant	q10-q14-1793421457888-tain-invoice	q10-q14-1793421457888-uncertain-customer	2026-10-31 04:37:38.092	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421457888-uncertain-user	2026-10-31 04:37:38.114	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:37:38.092	2026-10-31 04:37:38.114
q10-q14-1793421457888-concurrent-invoice	q10-q14-1793421457888-concurrent-tenant	q10-q14-1793421457888-rent-invoice	q10-q14-1793421457888-concurrent-customer	2026-10-31 04:37:38.176	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421457888-concurrent-user	2026-10-31 04:37:38.198	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:37:38.176	2026-10-31 04:37:38.198
q10-q14-1793421457888-conflicting-invoice	q10-q14-1793421457888-conflicting-tenant	q10-q14-1793421457888-ting-invoice	q10-q14-1793421457888-conflicting-customer	2026-10-31 04:37:38.215	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421457888-conflicting-user	2026-10-31 04:37:38.233	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:37:38.215	2026-10-31 04:37:38.233
q10-q14-1793421457888-b-invoice	q10-q14-1793421457888-b-tenant	q10-q14-1793421457888-b-draft	q10-q14-1793421457888-b-customer	2026-10-31 04:37:38.019	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421457888-b-user	2026-10-31 04:37:38.574	\N	\N	\N	Synthetic b	\N	\N	\N	MH	\N	\N	Synthetic Customer b	\N	\N	\N	MH	\N	\N	2026-10-31 04:37:38.019	2026-10-31 04:37:38.574
q10-q14-1793421457888-rollback-invoice	q10-q14-1793421457888-rollback-tenant	q10-q14-1793421457888-rollback-draft	q10-q14-1793421457888-rollback-customer	2026-10-31 04:37:38.14	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421457888-rollback-user	2026-10-31 04:38:53.025	\N	\N	\N	Synthetic rollback	\N	\N	\N	MH	\N	\N	Synthetic Customer rollback	\N	\N	\N	MH	\N	\N	2026-10-31 04:37:38.14	2026-10-31 04:38:53.025
q10-q14-1793421202430-b-invoice	q10-q14-1793421202430-b-tenant	q10-q14-1793421202430-b-draft	q10-q14-1793421202430-b-customer	2026-10-31 04:33:22.583	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421202430-b-user	2026-10-31 04:40:03.497	\N	\N	\N	Synthetic b	\N	\N	\N	MH	\N	\N	Synthetic Customer b	\N	\N	\N	MH	\N	\N	2026-10-31 04:33:22.583	2026-10-31 04:40:03.497
q10-q14-1793421051032-rollback-invoice	q10-q14-1793421051032-rollback-tenant	q10-q14-1793421051032-rollback-draft	q10-q14-1793421051032-rollback-customer	2026-10-31 04:30:51.468	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421051032-rollback-user	2026-10-31 04:44:28.018	\N	\N	\N	Synthetic rollback	\N	\N	\N	MH	\N	\N	Synthetic Customer rollback	\N	\N	\N	MH	\N	\N	2026-10-31 04:30:51.468	2026-10-31 04:44:28.018
q10-q14-1793421934870-a-invoice	q10-q14-1793421934870-a-tenant	q10-q14-1793421934870-70-a-invoice	q10-q14-1793421934870-a-customer	2026-10-31 04:45:34.921	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421934870-a-user	2026-10-31 04:45:34.968	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:45:34.921	2026-10-31 04:45:34.968
q10-q14-1793421934870-uncertain-invoice	q10-q14-1793421934870-uncertain-tenant	q10-q14-1793421934870-tain-invoice	q10-q14-1793421934870-uncertain-customer	2026-10-31 04:45:34.984	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421934870-uncertain-user	2026-10-31 04:45:34.994	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:45:34.984	2026-10-31 04:45:34.994
q10-q14-1793421934870-concurrent-invoice	q10-q14-1793421934870-concurrent-tenant	q10-q14-1793421934870-rent-invoice	q10-q14-1793421934870-concurrent-customer	2026-10-31 04:45:35.026	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421934870-concurrent-user	2026-10-31 04:45:35.038	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:45:35.026	2026-10-31 04:45:35.038
q10-q14-1793421934870-conflicting-invoice	q10-q14-1793421934870-conflicting-tenant	q10-q14-1793421934870-ting-invoice	q10-q14-1793421934870-conflicting-customer	2026-10-31 04:45:35.047	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421934870-conflicting-user	2026-10-31 04:45:35.058	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 04:45:35.047	2026-10-31 04:45:35.058
q10-q14-1793421934870-rollback-invoice	q10-q14-1793421934870-rollback-tenant	q10-q14-1793421934870-rollback-draft	q10-q14-1793421934870-rollback-customer	2026-10-31 04:45:35.008	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421934870-rollback-user	2026-10-31 04:45:35.712	\N	\N	\N	Synthetic rollback	\N	\N	\N	MH	\N	\N	Synthetic Customer rollback	\N	\N	\N	MH	\N	\N	2026-10-31 04:45:35.008	2026-10-31 04:45:35.712
q10-q14-1793421934870-b-invoice	q10-q14-1793421934870-b-tenant	q10-q14-1793421934870-b-draft	q10-q14-1793421934870-b-customer	2026-10-31 04:45:34.942	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793421934870-b-user	2026-10-31 04:45:35.759	\N	\N	\N	Synthetic b	\N	\N	\N	MH	\N	\N	Synthetic Customer b	\N	\N	\N	MH	\N	\N	2026-10-31 04:45:34.942	2026-10-31 04:45:35.759
q10-q14-1793428172549-a-invoice	q10-q14-1793428172549-a-tenant	q10-q14-1793428172549-49-a-invoice	q10-q14-1793428172549-a-customer	2026-10-31 06:29:32.66	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793428172549-a-user	2026-10-31 06:29:32.77	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 06:29:32.66	2026-10-31 06:29:32.77
q10-q14-1793428172549-uncertain-invoice	q10-q14-1793428172549-uncertain-tenant	q10-q14-1793428172549-tain-invoice	q10-q14-1793428172549-uncertain-customer	2026-10-31 06:29:32.813	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793428172549-uncertain-user	2026-10-31 06:29:32.842	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 06:29:32.813	2026-10-31 06:29:32.842
q10-q14-1793428172549-rollback-invoice	q10-q14-1793428172549-rollback-tenant	q10-q14-1793428172549-rollback-draft	q10-q14-1793428172549-rollback-customer	2026-10-31 06:29:32.882	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793428172549-rollback-user	2026-10-31 11:26:39.412	\N	\N	\N	Synthetic rollback	\N	\N	\N	MH	\N	\N	Synthetic Customer rollback	\N	\N	\N	MH	\N	\N	2026-10-31 06:29:32.882	2026-10-31 11:26:39.412
q10-q14-1793428172549-b-invoice	q10-q14-1793428172549-b-tenant	q10-q14-1793428172549-b-draft	q10-q14-1793428172549-b-customer	2026-10-31 06:29:32.707	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793428172549-b-user	2026-10-31 11:30:12.065	\N	\N	\N	Synthetic b	\N	\N	\N	MH	\N	\N	Synthetic Customer b	\N	\N	\N	MH	\N	\N	2026-10-31 06:29:32.707	2026-10-31 11:30:12.065
q10-q14-1793428172549-concurrent-invoice	q10-q14-1793428172549-concurrent-tenant	q10-q14-1793428172549-rent-invoice	q10-q14-1793428172549-concurrent-customer	2026-10-31 06:29:32.931	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793428172549-concurrent-user	2026-10-31 06:29:32.962	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 06:29:32.931	2026-10-31 06:29:32.962
q10-app-1793446286377-invoice-0	q10-app-1793446286377-tenant	q10-app-1793446286377-draft-0	q10-app-1793446286377-customer	2026-10-31 11:31:26.379	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793446286377-user	2026-10-31 11:31:26.87	\N	\N	\N	Q10 Application Synthetic	\N	\N	\N	MH	\N	\N	Q10 Application Customer	\N	\N	\N	MH	\N	\N	2026-10-31 11:31:26.379	2026-10-31 11:31:26.87
q10-app-1793446286377-invoice-1	q10-app-1793446286377-tenant	q10-app-1793446286377-draft-1	q10-app-1793446286377-customer	2026-10-31 11:31:26.379	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793446286377-user	2026-10-31 11:31:27.266	\N	\N	\N	Q10 Application Synthetic	\N	\N	\N	MH	\N	\N	Q10 Application Customer	\N	\N	\N	MH	\N	\N	2026-10-31 11:31:26.379	2026-10-31 11:31:27.266
q10-app-1793446623070-invoice-2	q10-app-1793446623070-tenant	q10-app-1793446623070-draft-2	q10-app-1793446623070-customer	2026-10-31 11:37:03.072	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793446623070-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 11:37:03.072	2026-10-31 11:37:03.072
q10-app-1793446623070-invoice-0	q10-app-1793446623070-tenant	q10-app-1793446623070-draft-0	q10-app-1793446623070-customer	2026-10-31 11:37:03.072	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793446623070-user	2026-10-31 11:37:03.763	\N	\N	\N	Q10 Application Synthetic	\N	\N	\N	MH	\N	\N	Q10 Application Customer	\N	\N	\N	MH	\N	\N	2026-10-31 11:37:03.072	2026-10-31 11:37:03.763
q10-app-1793446623070-invoice-1	q10-app-1793446623070-tenant	q10-app-1793446623070-draft-1	q10-app-1793446623070-customer	2026-10-31 11:37:03.072	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793446623070-user	2026-10-31 11:37:04.154	\N	\N	\N	Q10 Application Synthetic	\N	\N	\N	MH	\N	\N	Q10 Application Customer	\N	\N	\N	MH	\N	\N	2026-10-31 11:37:03.072	2026-10-31 11:37:04.154
q10-app-1793447402381-invoice-0	q10-app-1793447402381-tenant	q10-app-1793447402381-draft-0	q10-app-1793447402381-customer	2026-10-31 11:50:02.383	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793447402381-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 11:50:02.383	2026-10-31 11:50:02.383
q10-app-1793447402381-invoice-1	q10-app-1793447402381-tenant	q10-app-1793447402381-draft-1	q10-app-1793447402381-customer	2026-10-31 11:50:02.383	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793447402381-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 11:50:02.383	2026-10-31 11:50:02.383
q10-app-1793447402381-invoice-2	q10-app-1793447402381-tenant	q10-app-1793447402381-draft-2	q10-app-1793447402381-customer	2026-10-31 11:50:02.383	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793447402381-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 11:50:02.383	2026-10-31 11:50:02.383
q10-q14-1793447682627-b-invoice	q10-q14-1793447682627-b-tenant	q10-q14-1793447682627-b-draft	q10-q14-1793447682627-b-customer	2026-10-31 11:54:42.739	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793447682627-b-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 11:54:42.739	2026-10-31 11:54:42.739
q10-q14-1793447682627-a-invoice	q10-q14-1793447682627-a-tenant	q10-q14-1793447682627-27-a-invoice	q10-q14-1793447682627-a-customer	2026-10-31 11:54:42.698	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793447682627-a-user	2026-10-31 11:54:42.794	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 11:54:42.698	2026-10-31 11:54:42.794
q10-q14-1793447682627-uncertain-invoice	q10-q14-1793447682627-uncertain-tenant	q10-q14-1793447682627-tain-invoice	q10-q14-1793447682627-uncertain-customer	2026-10-31 11:54:42.819	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793447682627-uncertain-user	2026-10-31 11:54:42.838	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 11:54:42.819	2026-10-31 11:54:42.838
q10-q14-1793447682627-rollback-invoice	q10-q14-1793447682627-rollback-tenant	q10-q14-1793447682627-rollback-draft	q10-q14-1793447682627-rollback-customer	2026-10-31 11:54:42.863	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793447682627-rollback-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 11:54:42.863	2026-10-31 11:54:42.863
q10-q14-1793447682627-concurrent-invoice	q10-q14-1793447682627-concurrent-tenant	q10-q14-1793447682627-rent-invoice	q10-q14-1793447682627-concurrent-customer	2026-10-31 11:54:42.897	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793447682627-concurrent-user	2026-10-31 11:54:42.915	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 11:54:42.897	2026-10-31 11:54:42.915
q10-q14-1793447682627-conflicting-invoice	q10-q14-1793447682627-conflicting-tenant	q10-q14-1793447682627-ting-invoice	q10-q14-1793447682627-conflicting-customer	2026-10-31 11:54:42.93	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793447682627-conflicting-user	2026-10-31 11:54:42.947	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 11:54:42.93	2026-10-31 11:54:42.947
q10-app-1793453149906-invoice-2	q10-app-1793453149906-tenant	q10-app-1793453149906-draft-2	q10-app-1793453149906-customer	2026-10-31 13:25:49.908	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793453149906-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:25:49.908	2026-10-31 13:25:49.908
q10-app-1793453149906-invoice-0	q10-app-1793453149906-tenant	q10-app-1793453149906-draft-0	q10-app-1793453149906-customer	2026-10-31 13:25:49.908	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793453149906-user	2026-10-31 13:25:51.099	\N	\N	\N	Q10 Application Synthetic	\N	\N	\N	MH	\N	\N	Q10 Application Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:25:49.908	2026-10-31 13:25:51.099
q10-app-1793453149906-invoice-1	q10-app-1793453149906-tenant	q10-app-1793453149906-draft-1	q10-app-1793453149906-customer	2026-10-31 13:25:49.908	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793453149906-user	2026-10-31 13:25:51.626	\N	\N	\N	Q10 Application Synthetic	\N	\N	\N	MH	\N	\N	Q10 Application Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:25:49.908	2026-10-31 13:25:51.626
gst_e2e_sales_0224b8038dc047f58231f9d3b25fcad3	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	DRAFT-b25fcad3	gst_e2e_customer_c4436139548d46c6a24242f8181f1a30	2026-10-31 13:29:28.512	DRAFT	\N	MH	f	200.00	0.00	36.00	0.00	236.00	0.00	236.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:29:28.512	2026-10-31 13:29:28.512
gst_e2e_sales_success_3b4c635c1f2b4a2a84964299cff9a133	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	DRAFT-cff9a133	gst_e2e_customer_c4436139548d46c6a24242f8181f1a30	2026-10-31 13:29:28.512	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:29:28.512	2026-10-31 13:29:28.512
gst_e2e_snapshot_missing_invoice_6f0c45fdc5d44cd2a189aaa1bbc67355	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	GST016-aaa1bbc67355	gst_e2e_customer_dea834df00974cf59a8075e1de47eccc	2026-10-31 13:29:44.018	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	MH	\N	\N	2026-10-31 13:29:44.018	2026-10-31 13:29:44.018
gst_e2e_sales_b3a18f78406644b79f4dee3e61a84a0d	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	DRAFT-61a84a0d	gst_e2e_customer_73fddfc9bbd34e4ea7fdea62a9f84a1e	2026-10-31 13:29:58.518	DRAFT	\N	MH	f	200.00	0.00	36.00	0.00	236.00	0.00	236.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:29:58.518	2026-10-31 13:29:58.518
gst_e2e_sales_success_9047925573044ced9420a8dcd582d139	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	DRAFT-d582d139	gst_e2e_customer_73fddfc9bbd34e4ea7fdea62a9f84a1e	2026-10-31 13:29:58.518	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:29:58.518	2026-10-31 13:29:58.518
gst_e2e_snapshot_complete_invoice_8a5b29f81e19487487f7487d73e3c909	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	GST016-487d73e3c909	gst_e2e_customer_73fddfc9bbd34e4ea7fdea62a9f84a1e	2026-10-31 13:29:58.895	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	Original Seller	\N	\N	\N	MH	\N	\N	Original Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:29:58.895	2026-10-31 13:29:58.895
gst_e2e_snapshot_missing_invoice_9a3d1f7ded5e47a99144a53fdf833480	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	GST016-a53fdf833480	gst_e2e_customer_73fddfc9bbd34e4ea7fdea62a9f84a1e	2026-10-31 13:29:58.895	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	MH	\N	\N	2026-10-31 13:29:58.895	2026-10-31 13:29:58.895
gst_e2e_sales_d8589bedeecf42a983de03783b4fef54	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	DRAFT-3b4fef54	gst_e2e_customer_851024189a8e4d35be9004a36792d1cf	2026-10-31 13:30:12.558	DRAFT	\N	MH	f	200.00	0.00	36.00	0.00	236.00	0.00	236.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:30:12.558	2026-10-31 13:30:12.558
gst_e2e_sales_success_ca0b127b16784cc4a2751a71290edcc7	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	DRAFT-290edcc7	gst_e2e_customer_851024189a8e4d35be9004a36792d1cf	2026-10-31 13:30:12.558	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:30:12.558	2026-10-31 13:30:12.558
gst_e2e_sales_3ad05948c38340078a5edc7a22ee32b0	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	DRAFT-22ee32b0	gst_e2e_customer_d38392d3367a4e9a8e9439a1786fe2c4	2026-10-31 13:31:24.678	DRAFT	\N	MH	f	200.00	0.00	36.00	0.00	236.00	0.00	236.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:31:24.678	2026-10-31 13:31:24.678
q10-q14-1793428172549-conflicting-invoice	q10-q14-1793428172549-conflicting-tenant	q10-q14-1793428172549-ting-invoice	q10-q14-1793428172549-conflicting-customer	2026-10-31 06:29:32.989	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793428172549-conflicting-user	2026-10-31 06:29:33.014	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 06:29:32.989	2026-10-31 06:29:33.014
q10-app-1793446489184-invoice-2	q10-app-1793446489184-tenant	q10-app-1793446489184-draft-2	q10-app-1793446489184-customer	2026-10-31 11:34:49.185	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793446489184-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 11:34:49.185	2026-10-31 11:34:49.185
q10-q14-1793428213936-a-invoice	q10-q14-1793428213936-a-tenant	q10-q14-1793428213936-36-a-invoice	q10-q14-1793428213936-a-customer	2026-10-31 06:30:14.025	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793428213936-a-user	2026-10-31 06:30:14.11	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 06:30:14.025	2026-10-31 06:30:14.11
q10-app-1793446489184-invoice-0	q10-app-1793446489184-tenant	q10-app-1793446489184-draft-0	q10-app-1793446489184-customer	2026-10-31 11:34:49.185	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793446489184-user	2026-10-31 11:34:49.681	\N	\N	\N	Q10 Application Synthetic	\N	\N	\N	MH	\N	\N	Q10 Application Customer	\N	\N	\N	MH	\N	\N	2026-10-31 11:34:49.185	2026-10-31 11:34:49.681
q10-q14-1793428213936-uncertain-invoice	q10-q14-1793428213936-uncertain-tenant	q10-q14-1793428213936-tain-invoice	q10-q14-1793428213936-uncertain-customer	2026-10-31 06:30:14.142	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793428213936-uncertain-user	2026-10-31 06:30:14.16	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 06:30:14.142	2026-10-31 06:30:14.16
q10-app-1793446489184-invoice-1	q10-app-1793446489184-tenant	q10-app-1793446489184-draft-1	q10-app-1793446489184-customer	2026-10-31 11:34:49.185	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793446489184-user	2026-10-31 11:34:50.064	\N	\N	\N	Q10 Application Synthetic	\N	\N	\N	MH	\N	\N	Q10 Application Customer	\N	\N	\N	MH	\N	\N	2026-10-31 11:34:49.185	2026-10-31 11:34:50.064
q10-q14-1793446761696-b-invoice	q10-q14-1793446761696-b-tenant	q10-q14-1793446761696-b-draft	q10-q14-1793446761696-b-customer	2026-10-31 11:39:21.805	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793446761696-b-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 11:39:21.805	2026-10-31 11:39:21.805
q10-q14-1793428213936-concurrent-invoice	q10-q14-1793428213936-concurrent-tenant	q10-q14-1793428213936-rent-invoice	q10-q14-1793428213936-concurrent-customer	2026-10-31 06:30:14.226	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793428213936-concurrent-user	2026-10-31 06:30:14.246	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 06:30:14.226	2026-10-31 06:30:14.246
q10-q14-1793446761696-a-invoice	q10-q14-1793446761696-a-tenant	q10-q14-1793446761696-96-a-invoice	q10-q14-1793446761696-a-customer	2026-10-31 11:39:21.775	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793446761696-a-user	2026-10-31 11:39:21.851	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 11:39:21.775	2026-10-31 11:39:21.851
q10-q14-1793428213936-conflicting-invoice	q10-q14-1793428213936-conflicting-tenant	q10-q14-1793428213936-ting-invoice	q10-q14-1793428213936-conflicting-customer	2026-10-31 06:30:14.264	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793428213936-conflicting-user	2026-10-31 06:30:14.284	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 06:30:14.264	2026-10-31 06:30:14.284
q10-q14-1793428213936-rollback-invoice	q10-q14-1793428213936-rollback-tenant	q10-q14-1793428213936-rollback-draft	q10-q14-1793428213936-rollback-customer	2026-10-31 06:30:14.193	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793428213936-rollback-user	2026-10-31 11:14:12.77	\N	\N	\N	Synthetic rollback	\N	\N	\N	MH	\N	\N	Synthetic Customer rollback	\N	\N	\N	MH	\N	\N	2026-10-31 06:30:14.193	2026-10-31 11:14:12.77
q10-q14-1793428213936-b-invoice	q10-q14-1793428213936-b-tenant	q10-q14-1793428213936-b-draft	q10-q14-1793428213936-b-customer	2026-10-31 06:30:14.06	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793428213936-b-user	2026-10-31 11:14:12.824	\N	\N	\N	Synthetic b	\N	\N	\N	MH	\N	\N	Synthetic Customer b	\N	\N	\N	MH	\N	\N	2026-10-31 06:30:14.06	2026-10-31 11:14:12.824
q10-q14-1793446761696-uncertain-invoice	q10-q14-1793446761696-uncertain-tenant	q10-q14-1793446761696-tain-invoice	q10-q14-1793446761696-uncertain-customer	2026-10-31 11:39:21.875	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793446761696-uncertain-user	2026-10-31 11:39:21.891	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 11:39:21.875	2026-10-31 11:39:21.891
q10-q14-1793446761696-rollback-invoice	q10-q14-1793446761696-rollback-tenant	q10-q14-1793446761696-rollback-draft	q10-q14-1793446761696-rollback-customer	2026-10-31 11:39:21.92	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793446761696-rollback-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 11:39:21.92	2026-10-31 11:39:21.92
q10-q14-1793446761696-concurrent-invoice	q10-q14-1793446761696-concurrent-tenant	q10-q14-1793446761696-rent-invoice	q10-q14-1793446761696-concurrent-customer	2026-10-31 11:39:21.948	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793446761696-concurrent-user	2026-10-31 11:39:21.967	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 11:39:21.948	2026-10-31 11:39:21.967
q10-q14-1793446761696-conflicting-invoice	q10-q14-1793446761696-conflicting-tenant	q10-q14-1793446761696-ting-invoice	q10-q14-1793446761696-conflicting-customer	2026-10-31 11:39:21.986	FINALIZED	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-q14-1793446761696-conflicting-user	2026-10-31 11:39:22.009	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 11:39:21.986	2026-10-31 11:39:22.009
q10-app-1793447603960-invoice-2	q10-app-1793447603960-tenant	q10-app-1793447603960-draft-2	q10-app-1793447603960-customer	2026-10-31 11:53:23.961	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793447603960-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 11:53:23.961	2026-10-31 11:53:23.961
q10-app-1793447603960-invoice-0	q10-app-1793447603960-tenant	q10-app-1793447603960-draft-0	q10-app-1793447603960-customer	2026-10-31 11:53:23.961	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793447603960-user	2026-10-31 11:53:24.427	\N	\N	\N	Q10 Application Synthetic	\N	\N	\N	MH	\N	\N	Q10 Application Customer	\N	\N	\N	MH	\N	\N	2026-10-31 11:53:23.961	2026-10-31 11:53:24.427
q10-app-1793447603960-invoice-1	q10-app-1793447603960-tenant	q10-app-1793447603960-draft-1	q10-app-1793447603960-customer	2026-10-31 11:53:23.961	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793447603960-user	2026-10-31 11:53:24.809	\N	\N	\N	Q10 Application Synthetic	\N	\N	\N	MH	\N	\N	Q10 Application Customer	\N	\N	\N	MH	\N	\N	2026-10-31 11:53:23.961	2026-10-31 11:53:24.809
q10-app-1793452881250-invoice-2	q10-app-1793452881250-tenant	q10-app-1793452881250-draft-2	q10-app-1793452881250-customer	2026-10-31 13:21:21.252	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793452881250-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:21:21.252	2026-10-31 13:21:21.252
q10-app-1793452881250-invoice-0	q10-app-1793452881250-tenant	q10-app-1793452881250-draft-0	q10-app-1793452881250-customer	2026-10-31 13:21:21.252	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793452881250-user	2026-10-31 13:21:22.16	\N	\N	\N	Q10 Application Synthetic	\N	\N	\N	MH	\N	\N	Q10 Application Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:21:21.252	2026-10-31 13:21:22.16
q10-app-1793452881250-invoice-1	q10-app-1793452881250-tenant	q10-app-1793452881250-draft-1	q10-app-1793452881250-customer	2026-10-31 13:21:21.252	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793452881250-user	2026-10-31 13:21:22.608	\N	\N	\N	Q10 Application Synthetic	\N	\N	\N	MH	\N	\N	Q10 Application Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:21:21.252	2026-10-31 13:21:22.608
gst_e2e_sales_1f58c7ce3d574ea3880febcff80b07b2	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	DRAFT-f80b07b2	gst_e2e_customer_dea834df00974cf59a8075e1de47eccc	2026-10-31 13:29:43.689	DRAFT	\N	MH	f	200.00	0.00	36.00	0.00	236.00	0.00	236.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:29:43.689	2026-10-31 13:29:43.689
gst_e2e_sales_success_91524affce4b4b5cb5738c799d4a7f96	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	DRAFT-9d4a7f96	gst_e2e_customer_dea834df00974cf59a8075e1de47eccc	2026-10-31 13:29:43.689	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:29:43.689	2026-10-31 13:29:43.689
gst_e2e_snapshot_complete_invoice_0afbed6322ea4708a604b1a8f47ae5bb	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	GST016-b1a8f47ae5bb	gst_e2e_customer_dea834df00974cf59a8075e1de47eccc	2026-10-31 13:29:44.018	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	Original Seller	\N	\N	\N	MH	\N	\N	Original Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:29:44.018	2026-10-31 13:29:44.018
gst_e2e_snapshot_complete_invoice_44382fd544fe40529c56e692ac2a4b8a	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	GST016-e692ac2a4b8a	gst_e2e_customer_851024189a8e4d35be9004a36792d1cf	2026-10-31 13:30:12.923	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	Original Seller	\N	\N	\N	MH	\N	\N	Original Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:30:12.923	2026-10-31 13:30:12.923
gst_e2e_snapshot_missing_invoice_6d17ed1c52484f2d9bac277b9ea0df12	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	GST016-277b9ea0df12	gst_e2e_customer_851024189a8e4d35be9004a36792d1cf	2026-10-31 13:30:12.923	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	MH	\N	\N	2026-10-31 13:30:12.923	2026-10-31 13:30:12.923
gst_e2e_sales_success_bb9300a6bcd54ccb88f63170232f7a54	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	DRAFT-232f7a54	gst_e2e_customer_d38392d3367a4e9a8e9439a1786fe2c4	2026-10-31 13:31:24.678	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:31:24.678	2026-10-31 13:31:24.678
gst_e2e_snapshot_complete_invoice_6b251db9ecc34f4c87c8f154e3ffb3e5	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	GST016-f154e3ffb3e5	gst_e2e_customer_d38392d3367a4e9a8e9439a1786fe2c4	2026-10-31 13:31:24.884	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	Original Seller	\N	\N	\N	MH	\N	\N	Original Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:31:24.884	2026-10-31 13:31:24.884
gst_e2e_snapshot_missing_invoice_b8c200d69dfc44388fdc21e5e2b83fbf	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	GST016-21e5e2b83fbf	gst_e2e_customer_d38392d3367a4e9a8e9439a1786fe2c4	2026-10-31 13:31:24.884	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	MH	\N	\N	2026-10-31 13:31:24.884	2026-10-31 13:31:24.884
gst_e2e_sales_f3c798c4ac204e9fa72acda65b139826	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	DRAFT-5b139826	gst_e2e_customer_9fb72d8b5cc547d9977e7768ff0eb3e1	2026-10-31 13:32:42.82	DRAFT	\N	MH	f	200.00	0.00	36.00	0.00	236.00	0.00	236.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:32:42.82	2026-10-31 13:32:42.82
gst_e2e_snapshot_complete_invoice_5f6b36efd7364a589e051b78b5ac38f9	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	GST016-1b78b5ac38f9	gst_e2e_customer_9fb72d8b5cc547d9977e7768ff0eb3e1	2026-10-31 13:32:43.044	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	Original Seller	\N	\N	\N	MH	\N	\N	Original Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:32:43.044	2026-10-31 13:32:43.044
gst_e2e_snapshot_missing_invoice_6db2df43c1c2489da1376e5ef60e2eda	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	GST016-6e5ef60e2eda	gst_e2e_customer_9fb72d8b5cc547d9977e7768ff0eb3e1	2026-10-31 13:32:43.044	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	MH	\N	\N	2026-10-31 13:32:43.044	2026-10-31 13:32:43.044
gst_e2e_sales_success_c9722d460e8a47f6916e516454354bd4	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	DRAFT-54354bd4	gst_e2e_customer_9fb72d8b5cc547d9977e7768ff0eb3e1	2026-10-31 13:32:42.82	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	2026-10-31 13:32:44.318	\N	\N	\N	GST E2E Business	\N	\N	\N	MH	\N	\N	GST Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:32:42.82	2026-10-31 13:32:44.318
gst_e2e_sales_0400c2a8a2f4485387990039ed2bbf2c	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	DRAFT-ed2bbf2c	gst_e2e_customer_9c8f6b6af650473ca0686bf93bdf5f8a	2026-10-31 13:33:55.958	DRAFT	\N	MH	f	200.00	0.00	36.00	0.00	236.00	0.00	236.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:33:55.958	2026-10-31 13:33:55.958
gst_e2e_snapshot_complete_invoice_06dea3e83ad140ebaf5cd291dc55f049	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	GST016-d291dc55f049	gst_e2e_customer_9c8f6b6af650473ca0686bf93bdf5f8a	2026-10-31 13:33:56.19	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	Original Seller	\N	\N	\N	MH	\N	\N	Original Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:33:56.19	2026-10-31 13:33:56.19
gst_e2e_snapshot_missing_invoice_fa9440f5ebc54a37a2a4bb7b9b29432f	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	GST016-bb7b9b29432f	gst_e2e_customer_9c8f6b6af650473ca0686bf93bdf5f8a	2026-10-31 13:33:56.19	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	MH	\N	\N	2026-10-31 13:33:56.19	2026-10-31 13:33:56.19
gst_e2e_sales_success_0708541c7aef4e43a298df5fa0fa77e1	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	DRAFT-a0fa77e1	gst_e2e_customer_9c8f6b6af650473ca0686bf93bdf5f8a	2026-10-31 13:33:55.958	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	2026-10-31 13:33:57.468	\N	\N	\N	GST E2E Business	\N	\N	\N	MH	\N	\N	GST Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:33:55.958	2026-10-31 13:33:57.468
gst_e2e_sales_d4cb11dafc5043418ebb1b4b58f9972f	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	DRAFT-58f9972f	gst_e2e_customer_f7ec09f1760f449e8366f9a0a944e1cb	2026-10-31 13:35:09.31	DRAFT	\N	MH	f	200.00	0.00	36.00	0.00	236.00	0.00	236.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:35:09.31	2026-10-31 13:35:09.31
gst_e2e_snapshot_complete_invoice_50d7c7bade754197b725c87b9aac37bc	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	GST016-c87b9aac37bc	gst_e2e_customer_f7ec09f1760f449e8366f9a0a944e1cb	2026-10-31 13:35:09.503	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	Original Seller	\N	\N	\N	MH	\N	\N	Original Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:35:09.503	2026-10-31 13:35:09.503
gst_e2e_snapshot_missing_invoice_2a1e3958dcf94b4393517f7db81235a0	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	GST016-7f7db81235a0	gst_e2e_customer_f7ec09f1760f449e8366f9a0a944e1cb	2026-10-31 13:35:09.503	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	MH	\N	\N	2026-10-31 13:35:09.503	2026-10-31 13:35:09.503
gst_e2e_sales_success_afdbc6d5a3564cca92e3383e1fbd7e74	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	DRAFT-1fbd7e74	gst_e2e_customer_f7ec09f1760f449e8366f9a0a944e1cb	2026-10-31 13:35:09.31	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	2026-10-31 13:35:10.761	\N	\N	\N	GST E2E Business	\N	\N	\N	MH	\N	\N	GST Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:35:09.31	2026-10-31 13:35:10.761
gst_e2e_sales_5a2bfbea13744d2f94bb1966a501e87b	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	DRAFT-a501e87b	gst_e2e_customer_e7c7720acc5640c7a49b41af5d65f7ba	2026-10-31 13:36:28.408	DRAFT	\N	MH	f	200.00	0.00	36.00	0.00	236.00	0.00	236.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:36:28.408	2026-10-31 13:36:28.408
gst_e2e_snapshot_complete_invoice_906240a62b804cb28b103c76fd7b3310	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	GST016-3c76fd7b3310	gst_e2e_customer_e7c7720acc5640c7a49b41af5d65f7ba	2026-10-31 13:36:28.667	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	Original Seller	\N	\N	\N	MH	\N	\N	Original Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:36:28.667	2026-10-31 13:36:28.667
gst_e2e_snapshot_missing_invoice_c8123e251e9040bc828940787b7f64f6	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	GST016-40787b7f64f6	gst_e2e_customer_e7c7720acc5640c7a49b41af5d65f7ba	2026-10-31 13:36:28.667	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	MH	\N	\N	2026-10-31 13:36:28.667	2026-10-31 13:36:28.667
gst_e2e_sales_success_4c9c04755904459bba454f3edc4a0120	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	DRAFT-dc4a0120	gst_e2e_customer_e7c7720acc5640c7a49b41af5d65f7ba	2026-10-31 13:36:28.408	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	2026-10-31 13:36:30.209	\N	\N	\N	GST E2E Business	\N	\N	\N	MH	\N	\N	GST Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:36:28.408	2026-10-31 13:36:30.209
gst_e2e_sales_5d6669564f7c4aceac7a838c3e447363	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	DRAFT-3e447363	gst_e2e_customer_a21a9ba9d65143f28e834e3ab190721a	2026-10-31 13:37:50.384	DRAFT	\N	MH	f	200.00	0.00	36.00	0.00	236.00	0.00	236.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:37:50.384	2026-10-31 13:37:50.384
gst_e2e_snapshot_complete_invoice_ac7bce2f8c0c47d08e55d57f6ae90349	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	GST016-d57f6ae90349	gst_e2e_customer_a21a9ba9d65143f28e834e3ab190721a	2026-10-31 13:37:50.587	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	Original Seller	\N	\N	\N	MH	\N	\N	Original Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:37:50.587	2026-10-31 13:37:50.587
gst_e2e_snapshot_missing_invoice_38515b03cb664971b608b293057e4e3a	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	GST016-b293057e4e3a	gst_e2e_customer_a21a9ba9d65143f28e834e3ab190721a	2026-10-31 13:37:50.587	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	MH	\N	\N	2026-10-31 13:37:50.587	2026-10-31 13:37:50.587
gst_e2e_sales_success_76727966456547758e6f567b024f8d91	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	DRAFT-024f8d91	gst_e2e_customer_a21a9ba9d65143f28e834e3ab190721a	2026-10-31 13:37:50.384	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	2026-10-31 13:37:51.612	\N	\N	\N	GST E2E Business	\N	\N	\N	MH	\N	\N	GST Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:37:50.384	2026-10-31 13:37:51.612
gst_e2e_sales_0f015bc8a646486494b049de22f68888	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	DRAFT-22f68888	gst_e2e_customer_8ddd37d3f7b44572b56a8478c4adec59	2026-10-31 13:39:14.029	DRAFT	\N	MH	f	200.00	0.00	36.00	0.00	236.00	0.00	236.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:39:14.029	2026-10-31 13:39:14.029
gst_e2e_snapshot_complete_invoice_97be5a402a4546c4ad618640dcd83fb8	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	GST016-8640dcd83fb8	gst_e2e_customer_8ddd37d3f7b44572b56a8478c4adec59	2026-10-31 13:39:14.195	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	Original Seller	\N	\N	\N	MH	\N	\N	Original Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:39:14.195	2026-10-31 13:39:14.195
gst_e2e_snapshot_missing_invoice_2f3c9293f7cf4b8a9d12fe9c0b4c3ed6	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	GST016-fe9c0b4c3ed6	gst_e2e_customer_8ddd37d3f7b44572b56a8478c4adec59	2026-10-31 13:39:14.195	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	MH	\N	\N	2026-10-31 13:39:14.195	2026-10-31 13:39:14.195
gst_e2e_sales_success_9e5c4bd6a06442659dae4570dd904250	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	DRAFT-dd904250	gst_e2e_customer_8ddd37d3f7b44572b56a8478c4adec59	2026-10-31 13:39:14.029	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	2026-10-31 13:39:15.354	\N	\N	\N	GST E2E Business	\N	\N	\N	MH	\N	\N	GST Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:39:14.029	2026-10-31 13:39:15.354
gst_e2e_sales_f8e37dd2033b49c3aab38134d02e47d1	gst_e2e_tenant_19035406820a497699286f211ca126f6	DRAFT-d02e47d1	gst_e2e_customer_f56e9da2dcea4246bca746695a7dea4e	2026-10-31 13:40:27.581	DRAFT	\N	MH	f	200.00	0.00	36.00	0.00	236.00	0.00	236.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:40:27.581	2026-10-31 13:40:27.581
gst_e2e_snapshot_complete_invoice_de9ac7fddbe34e378e5ca24700354072	gst_e2e_tenant_19035406820a497699286f211ca126f6	GST016-a24700354072	gst_e2e_customer_f56e9da2dcea4246bca746695a7dea4e	2026-10-31 13:40:27.768	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	Original Seller	\N	\N	\N	MH	\N	\N	Original Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:40:27.768	2026-10-31 13:40:27.768
gst_e2e_snapshot_missing_invoice_8180c19b43db4e75ae708ad113523b43	gst_e2e_tenant_19035406820a497699286f211ca126f6	GST016-8ad113523b43	gst_e2e_customer_f56e9da2dcea4246bca746695a7dea4e	2026-10-31 13:40:27.768	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	MH	\N	\N	2026-10-31 13:40:27.768	2026-10-31 13:40:27.768
gst_e2e_sales_success_861a943099ab401896b2cf2663424588	gst_e2e_tenant_19035406820a497699286f211ca126f6	DRAFT-63424588	gst_e2e_customer_f56e9da2dcea4246bca746695a7dea4e	2026-10-31 13:40:27.581	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	2026-10-31 13:40:28.858	\N	\N	\N	GST E2E Business	\N	\N	\N	MH	\N	\N	GST Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:40:27.581	2026-10-31 13:40:28.858
gst_e2e_sales_69d4bbdb1a9645688a607babf878a140	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	DRAFT-f878a140	gst_e2e_customer_9cc2dac0526449ffbd1ddcf488281125	2026-10-31 13:41:41.091	DRAFT	\N	MH	f	200.00	0.00	36.00	0.00	236.00	0.00	236.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:41:41.091	2026-10-31 13:41:41.091
gst_e2e_snapshot_complete_invoice_b1e9a8689228467692483c186f60a4ba	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	GST016-3c186f60a4ba	gst_e2e_customer_9cc2dac0526449ffbd1ddcf488281125	2026-10-31 13:41:41.313	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	Original Seller	\N	\N	\N	MH	\N	\N	Original Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:41:41.313	2026-10-31 13:41:41.313
gst_e2e_snapshot_missing_invoice_3d26ae364d634abc93ce19e332609a78	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	GST016-19e332609a78	gst_e2e_customer_9cc2dac0526449ffbd1ddcf488281125	2026-10-31 13:41:41.313	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	MH	\N	\N	2026-10-31 13:41:41.313	2026-10-31 13:41:41.313
gst_e2e_sales_success_ad360a6411064d099a18d08fa4bf62c4	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	DRAFT-a4bf62c4	gst_e2e_customer_9cc2dac0526449ffbd1ddcf488281125	2026-10-31 13:41:41.091	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	2026-10-31 13:41:42.753	\N	\N	\N	GST E2E Business	\N	\N	\N	MH	\N	\N	GST Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:41:41.091	2026-10-31 13:41:42.753
gst_e2e_sales_a482ade43cfb45bbb9be7345c77aeb9a	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	DRAFT-c77aeb9a	gst_e2e_customer_1009f79da0544b509415c0b38d81b5c6	2026-10-31 13:42:54.027	DRAFT	\N	MH	f	200.00	0.00	36.00	0.00	236.00	0.00	236.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:42:54.027	2026-10-31 13:42:54.027
gst_e2e_snapshot_complete_invoice_f31c83c6eaaf48fea4e7a7b491243c2d	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	GST016-a7b491243c2d	gst_e2e_customer_1009f79da0544b509415c0b38d81b5c6	2026-10-31 13:42:54.23	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	Original Seller	\N	\N	\N	MH	\N	\N	Original Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:42:54.23	2026-10-31 13:42:54.23
gst_e2e_snapshot_missing_invoice_793a9074ae174635b446c44527e2b42e	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	GST016-c44527e2b42e	gst_e2e_customer_1009f79da0544b509415c0b38d81b5c6	2026-10-31 13:42:54.23	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	MH	\N	\N	2026-10-31 13:42:54.23	2026-10-31 13:42:54.23
gst_e2e_sales_success_b3d1b8d7803746e8a34a24ada270c41d	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	DRAFT-a270c41d	gst_e2e_customer_1009f79da0544b509415c0b38d81b5c6	2026-10-31 13:42:54.027	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	2026-10-31 13:42:55.614	\N	\N	\N	GST E2E Business	\N	\N	\N	MH	\N	\N	GST Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:42:54.027	2026-10-31 13:42:55.614
gst_e2e_sales_bcf79b8efa1e442ea929e70aef397081	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	DRAFT-ef397081	gst_e2e_customer_caf9c8df9ec844819ddb9b8bd1fa5e5a	2026-10-31 13:44:31.539	DRAFT	\N	MH	f	200.00	0.00	36.00	0.00	236.00	0.00	236.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:44:31.539	2026-10-31 13:44:31.539
gst_e2e_snapshot_complete_invoice_bdb57a67bfbc4b03957b052e44dc6855	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	GST016-052e44dc6855	gst_e2e_customer_caf9c8df9ec844819ddb9b8bd1fa5e5a	2026-10-31 13:44:31.776	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	Original Seller	\N	\N	\N	MH	\N	\N	Original Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:44:31.776	2026-10-31 13:44:31.776
gst_e2e_snapshot_missing_invoice_65bda4b0c53345818ba95a372b8f5040	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	GST016-5a372b8f5040	gst_e2e_customer_caf9c8df9ec844819ddb9b8bd1fa5e5a	2026-10-31 13:44:31.776	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	MH	\N	\N	2026-10-31 13:44:31.776	2026-10-31 13:44:31.776
gst_e2e_sales_success_e95ec457a9c74f97be29242a8011148c	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	DRAFT-8011148c	gst_e2e_customer_caf9c8df9ec844819ddb9b8bd1fa5e5a	2026-10-31 13:44:31.539	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	\N	2026-10-31 13:44:33.188	\N	\N	\N	GST E2E Business	\N	\N	\N	MH	\N	\N	GST Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:44:31.539	2026-10-31 13:44:33.188
q10-app-1793454341866-invoice-2	q10-app-1793454341866-tenant	q10-app-1793454341866-draft-2	q10-app-1793454341866-customer	2026-10-31 13:45:41.869	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793454341866-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:45:41.869	2026-10-31 13:45:41.869
q10-app-1793454341866-invoice-0	q10-app-1793454341866-tenant	q10-app-1793454341866-draft-0	q10-app-1793454341866-customer	2026-10-31 13:45:41.869	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793454341866-user	2026-10-31 13:45:42.676	\N	\N	\N	Q10 Application Synthetic	\N	\N	\N	MH	\N	\N	Q10 Application Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:45:41.869	2026-10-31 13:45:42.676
q10-app-1793454341866-invoice-1	q10-app-1793454341866-tenant	q10-app-1793454341866-draft-1	q10-app-1793454341866-customer	2026-10-31 13:45:41.869	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793454341866-user	2026-10-31 13:45:43.553	\N	\N	\N	Q10 Application Synthetic	\N	\N	\N	MH	\N	\N	Q10 Application Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:45:41.869	2026-10-31 13:45:43.553
q10-app-1793454409161-invoice-2	q10-app-1793454409161-tenant	q10-app-1793454409161-draft-2	q10-app-1793454409161-customer	2026-10-31 13:46:49.162	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793454409161-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:46:49.162	2026-10-31 13:46:49.162
q10-app-1793454409161-invoice-0	q10-app-1793454409161-tenant	q10-app-1793454409161-draft-0	q10-app-1793454409161-customer	2026-10-31 13:46:49.162	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793454409161-user	2026-10-31 13:46:49.885	\N	\N	\N	Q10 Application Synthetic	\N	\N	\N	MH	\N	\N	Q10 Application Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:46:49.162	2026-10-31 13:46:49.885
q10-app-1793454409161-invoice-1	q10-app-1793454409161-tenant	q10-app-1793454409161-draft-1	q10-app-1793454409161-customer	2026-10-31 13:46:49.162	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793454409161-user	2026-10-31 13:46:50.659	\N	\N	\N	Q10 Application Synthetic	\N	\N	\N	MH	\N	\N	Q10 Application Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:46:49.162	2026-10-31 13:46:50.659
q10-app-1793454491946-invoice-2	q10-app-1793454491946-tenant	q10-app-1793454491946-draft-2	q10-app-1793454491946-customer	2026-10-31 13:48:11.948	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793454491946-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 13:48:11.948	2026-10-31 13:48:11.948
q10-app-1793454491946-invoice-0	q10-app-1793454491946-tenant	q10-app-1793454491946-draft-0	q10-app-1793454491946-customer	2026-10-31 13:48:11.948	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793454491946-user	2026-10-31 13:48:12.768	\N	\N	\N	Q10 Application Synthetic	\N	\N	\N	MH	\N	\N	Q10 Application Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:48:11.948	2026-10-31 13:48:12.768
q10-app-1793454491946-invoice-1	q10-app-1793454491946-tenant	q10-app-1793454491946-draft-1	q10-app-1793454491946-customer	2026-10-31 13:48:11.948	FINALIZED	COMPLETE	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793454491946-user	2026-10-31 13:48:13.197	\N	\N	\N	Q10 Application Synthetic	\N	\N	\N	MH	\N	\N	Q10 Application Customer	\N	\N	\N	MH	\N	\N	2026-10-31 13:48:11.948	2026-10-31 13:48:13.197
q10-app-1793460716221-invoice-0	q10-app-1793460716221-tenant	q10-app-1793460716221-draft-0	q10-app-1793460716221-customer	2026-10-31 15:31:56.222	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793460716221-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 15:31:56.222	2026-10-31 15:31:56.222
q10-app-1793460716221-invoice-1	q10-app-1793460716221-tenant	q10-app-1793460716221-draft-1	q10-app-1793460716221-customer	2026-10-31 15:31:56.222	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793460716221-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 15:31:56.222	2026-10-31 15:31:56.222
q10-app-1793460716221-invoice-2	q10-app-1793460716221-tenant	q10-app-1793460716221-draft-2	q10-app-1793460716221-customer	2026-10-31 15:31:56.222	DRAFT	\N	MH	f	100.00	0.00	18.00	0.00	118.00	0.00	118.00	\N	\N	q10-app-1793460716221-user	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-10-31 15:31:56.222	2026-10-31 15:31:56.222
\.


--
-- Data for Name: sales_posting_operations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sales_posting_operations (id, tenant_id, sales_invoice_id, idempotency_key, request_payload_hash, status, result_invoice_no, result_sales_id, created_at, updated_at) FROM stdin;
q10-q14-1793420220210-bf74e97b-617a-423f-88c1-7ef8070a21b5	q10-q14-1793420220210-a-tenant	q10-q14-1793420220210-a-invoice	q10-q14-1793420220210-own	ea2b2e6d39c2ebc7299347bf8fe10ea9c63eb35697fd17f5d87a840ac23160a8	COMPLETED	q10-q14-1793420220210-10-a-invoice	q10-q14-1793420220210-a-invoice	2026-10-31 04:17:00.344	2026-10-31 04:17:00.344
q10-q14-1793420220210-fe705a45-59c4-46db-8cec-23d3b2cdcf33	q10-q14-1793420220210-concurrent-tenant	q10-q14-1793420220210-concurrent-invoice	q10-q14-1793420220210-concurrent	9087d52805f5fc6523bc5d98a7812ad06af3f13200b9e9188b3ff9a6eadad50d	COMPLETED	q10-q14-1793420220210-rent-invoice	q10-q14-1793420220210-concurrent-invoice	2026-10-31 04:17:00.46	2026-10-31 04:17:00.46
q10-q14-1793420355327-b9c7493d-e9bf-46be-b1aa-1194df4a02dc	q10-q14-1793420355327-a-tenant	q10-q14-1793420355327-a-invoice	q10-q14-1793420355327-own	a6e398c9f26f7e94af6f289de542c06d76fdf4be8d04623017cf3d643179068a	COMPLETED	q10-q14-1793420355327-27-a-invoice	q10-q14-1793420355327-a-invoice	2026-10-31 04:19:15.443	2026-10-31 04:19:15.443
q10-q14-1793420355327-c062cf1d-88d0-4db3-95bb-bdd3caacdf11	q10-q14-1793420355327-uncertain-tenant	q10-q14-1793420355327-uncertain-invoice	q10-q14-1793420355327-uncertain	be1e99267262266c478d84de7303cc8ecd9c28aa3859c35723ea6ae52d7a61dc	COMPLETED	q10-q14-1793420355327-tain-invoice	q10-q14-1793420355327-uncertain-invoice	2026-10-31 04:19:15.485	2026-10-31 04:19:15.485
q10-q14-1793420355327-e69e3c01-aaa5-4598-bc5a-c065d8ac71f6	q10-q14-1793420355327-concurrent-tenant	q10-q14-1793420355327-concurrent-invoice	q10-q14-1793420355327-concurrent	cde360e74117f6c0d0c61ca08a475e54536e6963e7c7145047193698054d3358	COMPLETED	q10-q14-1793420355327-rent-invoice	q10-q14-1793420355327-concurrent-invoice	2026-10-31 04:19:15.557	2026-10-31 04:19:15.557
q10-q14-1793420355327-e058d01a-e2ba-4078-931b-c541ac31be32	q10-q14-1793420355327-conflicting-tenant	q10-q14-1793420355327-conflicting-invoice	q10-q14-1793420355327-concurrent-conflict	b23cb367ccb8a87e1bfb3c0179dc24404454f7a20d8f78746681a330e87e3060	COMPLETED	q10-q14-1793420355327-ting-invoice	q10-q14-1793420355327-conflicting-invoice	2026-10-31 04:19:15.591	2026-10-31 04:19:15.591
q10-q14-1793421051032-3c261a47-de5a-41ed-8797-3031544fa7a3	q10-q14-1793421051032-a-tenant	q10-q14-1793421051032-a-invoice	q10-q14-1793421051032-own	891f7ab1a9941c95be080fd8abb058046407428df1cf354c3c62bc52d20bbcd4	COMPLETED	q10-q14-1793421051032-32-a-invoice	q10-q14-1793421051032-a-invoice	2026-10-31 04:30:51.303	2026-10-31 04:30:51.303
q10-q14-1793421051032-1460e82a-eb3b-4598-8b73-47fa130e0ebe	q10-q14-1793421051032-uncertain-tenant	q10-q14-1793421051032-uncertain-invoice	q10-q14-1793421051032-uncertain	85120bb801bbf01aa37d5624a2766f61ebec63b6d2efe47e1e217c0a9ebb3456	COMPLETED	q10-q14-1793421051032-tain-invoice	q10-q14-1793421051032-uncertain-invoice	2026-10-31 04:30:51.411	2026-10-31 04:30:51.411
q10-q14-1793421051032-2f30ccfe-f73a-4c2c-993c-385acb6c88f6	q10-q14-1793421051032-concurrent-tenant	q10-q14-1793421051032-concurrent-invoice	q10-q14-1793421051032-concurrent	b737406f6c5f32d3a08c906f74f15e4c84ee6943bdf3c81394bff25cc527e2d8	COMPLETED	q10-q14-1793421051032-rent-invoice	q10-q14-1793421051032-concurrent-invoice	2026-10-31 04:30:51.574	2026-10-31 04:30:51.574
q10-q14-1793421051032-8c4e085f-ee6d-4248-a54a-7666c16779f3	q10-q14-1793421051032-conflicting-tenant	q10-q14-1793421051032-conflicting-invoice	q10-q14-1793421051032-concurrent-conflict	c4ee8c3275e35d2a973e372ab891cebf748eedef1eb5e079df4140d9a9d56654	COMPLETED	q10-q14-1793421051032-ting-invoice	q10-q14-1793421051032-conflicting-invoice	2026-10-31 04:30:51.639	2026-10-31 04:30:51.639
q10-q14-1793421102644-2ee19b66-5c05-4a35-907a-2fd44065cc7a	q10-q14-1793421102644-a-tenant	q10-q14-1793421102644-a-invoice	q10-q14-1793421102644-own	3d241652c7bc7afaed77975e5e1ffe0ab763a1237ee6737622cd4d73b1477183	COMPLETED	q10-q14-1793421102644-44-a-invoice	q10-q14-1793421102644-a-invoice	2026-10-31 04:31:42.794	2026-10-31 04:31:42.794
q10-q14-1793421102644-558d636d-f8c7-4e07-ab07-b6f80ae9c144	q10-q14-1793421102644-uncertain-tenant	q10-q14-1793421102644-uncertain-invoice	q10-q14-1793421102644-uncertain	7d9e22668e2eb79761d7cc7ea38d2f5ff6a34c2a26ef00bef1d33b443c24c3d8	COMPLETED	q10-q14-1793421102644-tain-invoice	q10-q14-1793421102644-uncertain-invoice	2026-10-31 04:31:42.839	2026-10-31 04:31:42.839
q10-q14-1793421102644-c3bd1834-2a67-49ac-a80b-2abf05843f03	q10-q14-1793421102644-concurrent-tenant	q10-q14-1793421102644-concurrent-invoice	q10-q14-1793421102644-concurrent	f1395f2fc68af06878aa07a57ee040e65a74aac5e499631bc36cbda96ee6c45e	COMPLETED	q10-q14-1793421102644-rent-invoice	q10-q14-1793421102644-concurrent-invoice	2026-10-31 04:31:42.912	2026-10-31 04:31:42.912
q10-q14-1793421102644-d2e6df7d-ecdf-4168-949c-4c385f860212	q10-q14-1793421102644-conflicting-tenant	q10-q14-1793421102644-conflicting-invoice	q10-q14-1793421102644-concurrent-conflict	bb1eaaea8c97c7fd7a2e187368392c9900c154c44b8daaf1605173e9eeb04b74	COMPLETED	q10-q14-1793421102644-ting-invoice	q10-q14-1793421102644-conflicting-invoice	2026-10-31 04:31:42.946	2026-10-31 04:31:42.946
q10-q14-1793421202430-3d91c34d-8145-43d2-a119-fca0c6d2087e	q10-q14-1793421202430-a-tenant	q10-q14-1793421202430-a-invoice	q10-q14-1793421202430-own	4cb74b4f61a3ae58b80483c0cbd1d94a05de03d9b771a2fa3ea825d4c3452363	COMPLETED	q10-q14-1793421202430-30-a-invoice	q10-q14-1793421202430-a-invoice	2026-10-31 04:33:22.648	2026-10-31 04:33:22.648
q10-q14-1793421202430-317b43a9-05cd-4ab3-b64c-c83bc320ba8a	q10-q14-1793421202430-uncertain-tenant	q10-q14-1793421202430-uncertain-invoice	q10-q14-1793421202430-uncertain	13817e8530dbcb3888b68d233f816cb41758e6e75ff255c017a5edfd6e9df7bc	COMPLETED	q10-q14-1793421202430-tain-invoice	q10-q14-1793421202430-uncertain-invoice	2026-10-31 04:33:22.728	2026-10-31 04:33:22.728
q10-q14-1793421202430-ee22b461-31af-4dd6-910e-ce4e75bd78be	q10-q14-1793421202430-concurrent-tenant	q10-q14-1793421202430-concurrent-invoice	q10-q14-1793421202430-concurrent	3d23a6458758d0caf091ba9c3d217e48cde02accf56007d67eb5148e65734aae	COMPLETED	q10-q14-1793421202430-rent-invoice	q10-q14-1793421202430-concurrent-invoice	2026-10-31 04:33:22.85	2026-10-31 04:33:22.85
q10-q14-1793421202430-d06d5038-efac-4050-949f-5bceb3bb25fb	q10-q14-1793421202430-conflicting-tenant	q10-q14-1793421202430-conflicting-invoice	q10-q14-1793421202430-concurrent-conflict	6603cd29a642426652a0696afd0b9fce8df55b950c1f2d17dc1cbdca25d63087	COMPLETED	q10-q14-1793421202430-ting-invoice	q10-q14-1793421202430-conflicting-invoice	2026-10-31 04:33:22.906	2026-10-31 04:33:22.906
cmvvwsiaf000220j6w3t0azrt	q10-q14-1793421202430-rollback-tenant	q10-q14-1793421202430-rollback-invoice	q10-app-1793421391189-same-key	661acf8c7ce8223498f52f1197be5ef998d1df67a284dc946ea614f72df482d4	COMPLETED	q10-q14-1793421202430-rollback-draft	q10-q14-1793421202430-rollback-invoice	2026-10-31 04:36:31.767	2026-10-31 04:36:31.816
q10-q14-1793421457888-3019f6a8-d356-467a-b1fa-2a81dad8d245	q10-q14-1793421457888-a-tenant	q10-q14-1793421457888-a-invoice	q10-q14-1793421457888-own	312b68029b1fec9536f2c4cfb06d3379e61743ae5b944bb732c79830d6a44cc3	COMPLETED	q10-q14-1793421457888-88-a-invoice	q10-q14-1793421457888-a-invoice	2026-10-31 04:37:38.059	2026-10-31 04:37:38.059
q10-q14-1793421457888-fcbf4572-186f-4ca2-9fa1-97e350330513	q10-q14-1793421457888-uncertain-tenant	q10-q14-1793421457888-uncertain-invoice	q10-q14-1793421457888-uncertain	708199c91f5568680acc7bd85bd4070852e9bc38cd199915e351d556d10509f1	COMPLETED	q10-q14-1793421457888-tain-invoice	q10-q14-1793421457888-uncertain-invoice	2026-10-31 04:37:38.114	2026-10-31 04:37:38.114
cmvvwzvz60002docn6kylfx1v	q10-q14-1793421102644-rollback-tenant	q10-q14-1793421102644-rollback-invoice	q10-app-1793421735676-same-key	a9713bdbae5649b64266bc480020d46d21ce6fe6c180e0275a0d02c9e72886f3	COMPLETED	q10-q14-1793421102644-rollback-draft	q10-q14-1793421102644-rollback-invoice	2026-10-31 04:42:16.098	2026-10-31 04:42:16.153
q10-q14-1793447682627-1b36164a-5e72-41cb-9136-edbb6709196c	q10-q14-1793447682627-a-tenant	q10-q14-1793447682627-a-invoice	q10-q14-1793447682627-own	3be3e6dec506548171836f81765f53b381d200e742e4099f48c22eaccca659aa	COMPLETED	q10-q14-1793447682627-27-a-invoice	q10-q14-1793447682627-a-invoice	2026-10-31 11:54:42.794	2026-10-31 11:54:42.794
q10-q14-1793421457888-b1963789-e2a6-480e-862b-821793a40a24	q10-q14-1793421457888-concurrent-tenant	q10-q14-1793421457888-concurrent-invoice	q10-q14-1793421457888-concurrent	82537e29b5119a3f9c2f00ba53d22a506012f659a55758b2aa135bc31894c9b9	COMPLETED	q10-q14-1793421457888-rent-invoice	q10-q14-1793421457888-concurrent-invoice	2026-10-31 04:37:38.198	2026-10-31 04:37:38.198
cmvvwzw1u000ddocn3gb2zvu4	q10-q14-1793421102644-b-tenant	q10-q14-1793421102644-b-invoice	q10-app-1793421735676-concurrent	2f52cf5bb3065d9cd262cffeaa025b87570336ee27fa766fc2469d4d4c1c8305	COMPLETED	q10-q14-1793421102644-b-draft	q10-q14-1793421102644-b-invoice	2026-10-31 04:42:16.194	2026-10-31 04:42:16.234
q10-q14-1793421457888-2f185e2e-41d0-401d-836d-1f59f1e93bc2	q10-q14-1793421457888-conflicting-tenant	q10-q14-1793421457888-conflicting-invoice	q10-q14-1793421457888-concurrent-conflict	46a6e68ce31640c2ffedfd22cd79c3c7dbef75a67407633a3507a7091981ad8d	COMPLETED	q10-q14-1793421457888-ting-invoice	q10-q14-1793421457888-conflicting-invoice	2026-10-31 04:37:38.233	2026-10-31 04:37:38.233
cmvvx2pqq00029hdlduoipta6	q10-q14-1793421051032-rollback-tenant	q10-q14-1793421051032-rollback-invoice	q10-app-1793421867598-same-key	e98ab006adb0217cf0c09e1485665c2da28624a049455fc0277ece0a7d962c70	COMPLETED	q10-q14-1793421051032-rollback-draft	q10-q14-1793421051032-rollback-invoice	2026-10-31 04:44:27.986	2026-10-31 04:44:28.035
cmvvwtxta000213ymqyx1w0sb	q10-q14-1793421457888-b-tenant	q10-q14-1793421457888-b-invoice	q10-app-1793421458139-same-key	299c8ec38bd50dfa894b48d48a6829694bcee6a4b6006f61ed292ff5fb4b4d77	COMPLETED	q10-q14-1793421457888-b-draft	q10-q14-1793421457888-b-invoice	2026-10-31 04:37:38.543	2026-10-31 04:37:38.592
cmvvwvj9a0002d1y2ogjevm55	q10-q14-1793421457888-rollback-tenant	q10-q14-1793421457888-rollback-invoice	q10-app-1793421532563-same-key	65a497bdd920411fd424d3017642d591472c7ee543b4a182bb8f8ec57f1a424e	COMPLETED	q10-q14-1793421457888-rollback-draft	q10-q14-1793421457888-rollback-invoice	2026-10-31 04:38:52.991	2026-10-31 04:38:53.041
cmvvwx1mz0002zg7x4ppatevd	q10-q14-1793421202430-b-tenant	q10-q14-1793421202430-b-invoice	q10-app-1793421603095-same-key	92ab611d4139b30169a464420fd2988bc14e9e16831c820689e86c9532a88a9f	COMPLETED	q10-q14-1793421202430-b-draft	q10-q14-1793421202430-b-invoice	2026-10-31 04:40:03.468	2026-10-31 04:40:03.511
cmvvx2pt4000d9hdlav0o6kqh	q10-q14-1793421051032-b-tenant	q10-q14-1793421051032-b-invoice	q10-app-1793421867598-concurrent	dfba4cd4a075a7d4fb1123c57567f5d325f4ea9ad1922ff1674252740c623f90	COMPLETED	q10-q14-1793421051032-b-draft	q10-q14-1793421051032-b-invoice	2026-10-31 04:44:28.072	2026-10-31 04:44:28.103
q10-q14-1793421934870-86549386-daae-42c2-a98c-2a0bb6dc6846	q10-q14-1793421934870-a-tenant	q10-q14-1793421934870-a-invoice	q10-q14-1793421934870-own	e5087a21132bbe3f4c2b797293fdc58bc1450e016c928cd3dd252fc7cc591b3e	COMPLETED	q10-q14-1793421934870-70-a-invoice	q10-q14-1793421934870-a-invoice	2026-10-31 04:45:34.968	2026-10-31 04:45:34.968
q10-q14-1793421934870-51f24432-9ac1-4c29-b164-727338a2f7bd	q10-q14-1793421934870-uncertain-tenant	q10-q14-1793421934870-uncertain-invoice	q10-q14-1793421934870-uncertain	ae497530d1ee694e41e045e5d46fddc34d5145e9c85b85089a3fd635baec76d6	COMPLETED	q10-q14-1793421934870-tain-invoice	q10-q14-1793421934870-uncertain-invoice	2026-10-31 04:45:34.994	2026-10-31 04:45:34.994
q10-q14-1793421934870-76b6c5fe-d47b-46c2-b7bb-694232e5cb4a	q10-q14-1793421934870-concurrent-tenant	q10-q14-1793421934870-concurrent-invoice	q10-q14-1793421934870-concurrent	5b1ea026fae6ad67a6814a0cbaed75643d81ac735c9ca2ff4462fe3bea6295d6	COMPLETED	q10-q14-1793421934870-rent-invoice	q10-q14-1793421934870-concurrent-invoice	2026-10-31 04:45:35.038	2026-10-31 04:45:35.038
q10-q14-1793421934870-3bcc95e2-f7b8-479f-a7dc-a77cbbf35251	q10-q14-1793421934870-conflicting-tenant	q10-q14-1793421934870-conflicting-invoice	q10-q14-1793421934870-concurrent-conflict	1b0a16dc10226443f6dd58079c248a3e4e6979eb4a73215ad750188340c9f75d	COMPLETED	q10-q14-1793421934870-ting-invoice	q10-q14-1793421934870-conflicting-invoice	2026-10-31 04:45:35.058	2026-10-31 04:45:35.058
cmvvx45zf00024b8g67rmojqf	q10-q14-1793421934870-rollback-tenant	q10-q14-1793421934870-rollback-invoice	q10-app-1793421935353-same-key	2cdf6e2cebf2ce5b9b993035b2a6903fff22688d9f2936ffdb78e7daf6806cbd	COMPLETED	q10-q14-1793421934870-rollback-draft	q10-q14-1793421934870-rollback-invoice	2026-10-31 04:45:35.691	2026-10-31 04:45:35.723
cmvvx460z000d4b8gpftbr3jq	q10-q14-1793421934870-b-tenant	q10-q14-1793421934870-b-invoice	q10-app-1793421935353-concurrent	f8915a709883bab6b3f60ca91a76fac4a3ef6e0e14166f37b96735fe08cc7243	COMPLETED	q10-q14-1793421934870-b-draft	q10-q14-1793421934870-b-invoice	2026-10-31 04:45:35.747	2026-10-31 04:45:35.768
q10-q14-1793428172549-668ed517-a7ef-4b6a-9dc6-904a8a8f1eb9	q10-q14-1793428172549-a-tenant	q10-q14-1793428172549-a-invoice	q10-q14-1793428172549-own	882768a95f5cd8ad6cb764daaf8a53ac037344cd22083e1ffcf896d5d4ff054e	COMPLETED	q10-q14-1793428172549-49-a-invoice	q10-q14-1793428172549-a-invoice	2026-10-31 06:29:32.77	2026-10-31 06:29:32.77
q10-q14-1793428172549-a19247c4-507f-44ac-bee9-59402b2f1ae3	q10-q14-1793428172549-uncertain-tenant	q10-q14-1793428172549-uncertain-invoice	q10-q14-1793428172549-uncertain	544c4ca54f23d5477020072cc0458fbef6c7ba725745f737f17c1524b52d24c4	COMPLETED	q10-q14-1793428172549-tain-invoice	q10-q14-1793428172549-uncertain-invoice	2026-10-31 06:29:32.842	2026-10-31 06:29:32.842
q10-q14-1793428172549-42c030f8-13f6-4b3d-9ad3-d8d6f5b7afb3	q10-q14-1793428172549-concurrent-tenant	q10-q14-1793428172549-concurrent-invoice	q10-q14-1793428172549-concurrent	06dfa03e7cbabf0109baf778c3b5755637d258cf261f551656fd38d198e72bd9	COMPLETED	q10-q14-1793428172549-rent-invoice	q10-q14-1793428172549-concurrent-invoice	2026-10-31 06:29:32.962	2026-10-31 06:29:32.962
q10-q14-1793428172549-ed5cacab-3dc9-418e-8b64-b47a0319a6ac	q10-q14-1793428172549-conflicting-tenant	q10-q14-1793428172549-conflicting-invoice	q10-q14-1793428172549-concurrent-conflict	a35cbfa65524e4762d34c3d70614219991146be3cd3e35f6c01fcaa92c5e5e77	COMPLETED	q10-q14-1793428172549-ting-invoice	q10-q14-1793428172549-conflicting-invoice	2026-10-31 06:29:33.014	2026-10-31 06:29:33.014
q10-q14-1793428213936-659674bf-bc41-41fa-80bd-052ada9f7ace	q10-q14-1793428213936-a-tenant	q10-q14-1793428213936-a-invoice	q10-q14-1793428213936-own	434d296ec20d1aea7de730bd1a336c35b2a35ab5b9bb851b092af03be7e86890	COMPLETED	q10-q14-1793428213936-36-a-invoice	q10-q14-1793428213936-a-invoice	2026-10-31 06:30:14.11	2026-10-31 06:30:14.11
q10-q14-1793428213936-37cc71f8-fd8f-4225-ac22-cd9ffdae1112	q10-q14-1793428213936-uncertain-tenant	q10-q14-1793428213936-uncertain-invoice	q10-q14-1793428213936-uncertain	0e2107680e1baaad635d7e96eea6054a7e22f1d7aae09302d17733a9b827df65	COMPLETED	q10-q14-1793428213936-tain-invoice	q10-q14-1793428213936-uncertain-invoice	2026-10-31 06:30:14.16	2026-10-31 06:30:14.16
q10-q14-1793428213936-91d2a98f-442c-447f-a174-58f6d9ab4df0	q10-q14-1793428213936-concurrent-tenant	q10-q14-1793428213936-concurrent-invoice	q10-q14-1793428213936-concurrent	6295b4420941ea1909906a3a41479d7a035ab1bb952cf77818257ef2c693abd8	COMPLETED	q10-q14-1793428213936-rent-invoice	q10-q14-1793428213936-concurrent-invoice	2026-10-31 06:30:14.246	2026-10-31 06:30:14.246
q10-q14-1793447682627-96f8f345-2289-4c37-ab66-1fd60bff6a21	q10-q14-1793447682627-uncertain-tenant	q10-q14-1793447682627-uncertain-invoice	q10-q14-1793447682627-uncertain	93e303d5efdb483368987e0add2838f9ea700cb0190049a624b5aeb1f9beb9d3	COMPLETED	q10-q14-1793447682627-tain-invoice	q10-q14-1793447682627-uncertain-invoice	2026-10-31 11:54:42.838	2026-10-31 11:54:42.838
q10-q14-1793428213936-1a04ffe1-37b2-4c4e-abe3-f714a5db0180	q10-q14-1793428213936-conflicting-tenant	q10-q14-1793428213936-conflicting-invoice	q10-q14-1793428213936-concurrent-conflict	5ff023522eacf43c3ffd444884033a079f0f032a05e7cdd614bf0195702fffda	COMPLETED	q10-q14-1793428213936-ting-invoice	q10-q14-1793428213936-conflicting-invoice	2026-10-31 06:30:14.284	2026-10-31 06:30:14.284
cmvwazxjd0002ujqzei1sdohe	q10-q14-1793428213936-rollback-tenant	q10-q14-1793428213936-rollback-invoice	q10-app-1793445252266-same-key	e11907fcc1a801c65ed935bd730305594b1f5be623961371eed84d1d852f3ed9	COMPLETED	q10-q14-1793428213936-rollback-draft	q10-q14-1793428213936-rollback-invoice	2026-10-31 11:14:12.745	2026-10-31 11:14:12.784
cmvwazxl6000dujqztmfe94vc	q10-q14-1793428213936-b-tenant	q10-q14-1793428213936-b-invoice	q10-app-1793445252266-concurrent	5f066e04585b59c409d79a9efde46756d89706df1bc99ec2c0f7ccc881a86ef6	COMPLETED	q10-q14-1793428213936-b-draft	q10-q14-1793428213936-b-invoice	2026-10-31 11:14:12.81	2026-10-31 11:14:12.833
cmvwbfxmt0002xur64avorfnp	q10-q14-1793428172549-rollback-tenant	q10-q14-1793428172549-rollback-invoice	q10-app-1793445998811-same-key	4d59d95fcb1f067dc3c618073b74b178af11eb93973b15bfb1da5a2ab54a75cd	COMPLETED	q10-q14-1793428172549-rollback-draft	q10-q14-1793428172549-rollback-invoice	2026-10-31 11:26:39.365	2026-10-31 11:26:39.44
q10-q14-1793447682627-030706d6-1268-4d5f-b718-24be9100829a	q10-q14-1793447682627-concurrent-tenant	q10-q14-1793447682627-concurrent-invoice	q10-q14-1793447682627-concurrent	582cdb1a2ac6246bab18e3c9782e02d5395ecab2201e9fc183358fbb4eed715e	COMPLETED	q10-q14-1793447682627-rent-invoice	q10-q14-1793447682627-concurrent-invoice	2026-10-31 11:54:42.915	2026-10-31 11:54:42.915
cmvwbkhq70002t34w7maji2i1	q10-q14-1793428172549-b-tenant	q10-q14-1793428172549-b-invoice	q10-app-1793446211634-same-key	4c837b10f7c1ef3ff0f0658ca4b01cf513f88393fc57c101a894f965aaf3cb39	COMPLETED	q10-q14-1793428172549-b-draft	q10-q14-1793428172549-b-invoice	2026-10-31 11:30:12.032	2026-10-31 11:30:12.083
cmvwbm3g30002a8p221zjzbte	q10-app-1793446286377-tenant	q10-app-1793446286377-invoice-0	q10-app-1793446286377-same-key	a06b25441ab2a295d3908e7d2bfb209068512b56d3ba6b1117e06867f645f462	COMPLETED	q10-app-1793446286377-draft-0	q10-app-1793446286377-invoice-0	2026-10-31 11:31:26.836	2026-10-31 11:31:26.888
q10-q14-1793447682627-ed5bb838-659c-466e-b375-c01d2f9715d9	q10-q14-1793447682627-conflicting-tenant	q10-q14-1793447682627-conflicting-invoice	q10-q14-1793447682627-concurrent-conflict	4a6d0484f445e9420d6f2b712ad1793cdfa3370d9eb4382bb371f23cae62f55f	COMPLETED	q10-q14-1793447682627-ting-invoice	q10-q14-1793447682627-conflicting-invoice	2026-10-31 11:54:42.947	2026-10-31 11:54:42.947
cmvwbm3rc000ea8p2dectd4kd	q10-app-1793446286377-tenant	q10-app-1793446286377-invoice-1	q10-app-1793446286377-concurrent	d73068a01d30e6bd9b1cc1d0374c111c3d6a315b9e7c3538c97c661e2d722146	COMPLETED	q10-app-1793446286377-draft-1	q10-app-1793446286377-invoice-1	2026-10-31 11:31:27.241	2026-10-31 11:31:27.281
cmvwfjge70002nht7gbwvd456	q10-app-1793452881250-tenant	q10-app-1793452881250-invoice-0	q10-app-1793452881250-same-key	e1f75f294a651c267fefa147a408a71366537d6d6cc14075c55c445f0c1c5786	COMPLETED	q10-app-1793452881250-draft-0	q10-app-1793452881250-invoice-0	2026-10-31 13:21:22.11	2026-10-31 13:21:22.187
cmvwbqfxr0002ic7xkdnupiuf	q10-app-1793446489184-tenant	q10-app-1793446489184-invoice-0	q10-app-1793446489184-same-key	abf01805c01224f324d88149c9de1cddae1080ca98f6c165ec893cfa4014661e	COMPLETED	q10-app-1793446489184-draft-0	q10-app-1793446489184-invoice-0	2026-10-31 11:34:49.647	2026-10-31 11:34:49.698
cmvwfjgr5000enht7hj4e9s9g	q10-app-1793452881250-tenant	q10-app-1793452881250-invoice-1	q10-app-1793452881250-concurrent	b720f06c077b2c4f3dbd9a1661c37eefbfbff6745d2caac4d04ce2f1305e6c12	COMPLETED	q10-app-1793452881250-draft-1	q10-app-1793452881250-invoice-1	2026-10-31 13:21:22.577	2026-10-31 13:21:22.628
cmvwbqg8l000eic7x6eggmo9p	q10-app-1793446489184-tenant	q10-app-1793446489184-invoice-1	q10-app-1793446489184-concurrent	b89eb5349e66800b0a2eb2ea3b72a1e07f3735b673ad420d4ff1c9cbb7297cc9	COMPLETED	q10-app-1793446489184-draft-1	q10-app-1793446489184-invoice-1	2026-10-31 11:34:50.037	2026-10-31 11:34:50.084
cmvwbtbe30002kljepvglx9wh	q10-app-1793446623070-tenant	q10-app-1793446623070-invoice-0	q10-app-1793446623070-same-key	05f113569d1a370d901ba4c977e5798cf22f7cac20579a07f7a84467c5a3b59a	COMPLETED	q10-app-1793446623070-draft-0	q10-app-1793446623070-invoice-0	2026-10-31 11:37:03.723	2026-10-31 11:37:03.786
cmvwbtbpi000ekljetu6it8s7	q10-app-1793446623070-tenant	q10-app-1793446623070-invoice-1	q10-app-1793446623070-concurrent	59d28d5e596cc6213a4027817d216ec899eec6150ccb410ff716d867d98e4eda	COMPLETED	q10-app-1793446623070-draft-1	q10-app-1793446623070-invoice-1	2026-10-31 11:37:04.134	2026-10-31 11:37:04.168
q10-q14-1793446761696-81a616fb-4f39-4766-8456-a236789cdae7	q10-q14-1793446761696-a-tenant	q10-q14-1793446761696-a-invoice	q10-q14-1793446761696-own	118776c84a138c8228008ee6924eedd1dacd9e658248b58d12f1bde6d894994f	COMPLETED	q10-q14-1793446761696-96-a-invoice	q10-q14-1793446761696-a-invoice	2026-10-31 11:39:21.851	2026-10-31 11:39:21.851
q10-q14-1793446761696-538f89ab-bc71-417d-a2d1-ebe0d781ed28	q10-q14-1793446761696-uncertain-tenant	q10-q14-1793446761696-uncertain-invoice	q10-q14-1793446761696-uncertain	11b2114dbe624b1ae43de4ce2323ab50b5a1c2aa30eb70eb3f961b48ec47712a	COMPLETED	q10-q14-1793446761696-tain-invoice	q10-q14-1793446761696-uncertain-invoice	2026-10-31 11:39:21.891	2026-10-31 11:39:21.891
q10-q14-1793446761696-f72771c8-353f-4005-b681-713022f3e2db	q10-q14-1793446761696-concurrent-tenant	q10-q14-1793446761696-concurrent-invoice	q10-q14-1793446761696-concurrent	c3beef5d5eeea223bf3739c3cccb800d4bbcce4a8f4cad438da833259be96255	COMPLETED	q10-q14-1793446761696-rent-invoice	q10-q14-1793446761696-concurrent-invoice	2026-10-31 11:39:21.967	2026-10-31 11:39:21.967
q10-q14-1793446761696-bbd9acb3-f786-47eb-a3e8-ec4c43578f31	q10-q14-1793446761696-conflicting-tenant	q10-q14-1793446761696-conflicting-invoice	q10-q14-1793446761696-concurrent-conflict	5b71b1bb56e5527cbb86967fc9b8311017a5196e85a074568e15478d5898f6a3	COMPLETED	q10-q14-1793446761696-ting-invoice	q10-q14-1793446761696-conflicting-invoice	2026-10-31 11:39:22.009	2026-10-31 11:39:22.009
cmvwcec3200025hhtl4d9j1rc	q10-app-1793447603960-tenant	q10-app-1793447603960-invoice-0	q10-app-1793447603960-same-key	68de699a2916f7f8c1b62e52c052eda6c29d3e2d44c0ca9f7b646c2d53460fd8	COMPLETED	q10-app-1793447603960-draft-0	q10-app-1793447603960-invoice-0	2026-10-31 11:53:24.398	2026-10-31 11:53:24.443
cmvwcece0000e5hhtsr9bftn4	q10-app-1793447603960-tenant	q10-app-1793447603960-invoice-1	q10-app-1793447603960-concurrent	9e4de4a768b83ccf6a9d8c847eadd527169c0ff18ba5b62ec071a07c9fe1d53b	COMPLETED	q10-app-1793447603960-draft-1	q10-app-1793447603960-invoice-1	2026-10-31 11:53:24.793	2026-10-31 11:53:24.822
cmvwfp7vs0002axymneju7i3g	q10-app-1793453149906-tenant	q10-app-1793453149906-invoice-0	q10-app-1793453149906-same-key	09288213fe9fcc644e10df2e15e2aba1215d1397c0222903a1e81b848fb5c070	COMPLETED	q10-app-1793453149906-draft-0	q10-app-1793453149906-invoice-0	2026-10-31 13:25:51.015	2026-10-31 13:25:51.137
cmvwfp8be000eaxym81zkapz9	q10-app-1793453149906-tenant	q10-app-1793453149906-invoice-1	q10-app-1793453149906-concurrent	0158f09f908af0b27313d0e40ab10196d949aebea189811f2747f714776b8528	COMPLETED	q10-app-1793453149906-draft-1	q10-app-1793453149906-invoice-1	2026-10-31 13:25:51.578	2026-10-31 13:25:51.653
cmvwfy2rj000e99yrmpdw5ji2	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_sales_success_c9722d460e8a47f6916e516454354bd4	gst-e2e-success-gst_e2e_sales_success_c9722d460e8a47f6916e516454354bd4	725dc39b8f7883ccbe37484439e41def1157663912879e4b6875b8e421237d99	COMPLETED	DRAFT-54354bd4	gst_e2e_sales_success_c9722d460e8a47f6916e516454354bd4	2026-10-31 13:32:44.288	2026-10-31 13:32:44.346
cmvwfzn7f000eza3t7bs5qxo7	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_sales_success_0708541c7aef4e43a298df5fa0fa77e1	gst-e2e-success-gst_e2e_sales_success_0708541c7aef4e43a298df5fa0fa77e1	829e73f2d150014c6d0c95a92cb959e778c085bc668925e57d04f08375163482	COMPLETED	DRAFT-a0fa77e1	gst_e2e_sales_success_0708541c7aef4e43a298df5fa0fa77e1	2026-10-31 13:33:57.436	2026-10-31 13:33:57.492
cmvwg17rd000elgotto60yizw	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_sales_success_afdbc6d5a3564cca92e3383e1fbd7e74	gst-e2e-success-gst_e2e_sales_success_afdbc6d5a3564cca92e3383e1fbd7e74	11dbb732d9888a171f38ef5b4236345fe444d9c17d47db3d5ad18e63fbd39a23	COMPLETED	DRAFT-1fbd7e74	gst_e2e_sales_success_afdbc6d5a3564cca92e3383e1fbd7e74	2026-10-31 13:35:10.73	2026-10-31 13:35:10.794
cmvwg2x24000e2plh7n205m5c	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_sales_success_4c9c04755904459bba454f3edc4a0120	gst-e2e-success-gst_e2e_sales_success_4c9c04755904459bba454f3edc4a0120	31775a37885045ef4298c2a6c647debe8ca4af446eda073fb3f21b671b1eb0ec	COMPLETED	DRAFT-dc4a0120	gst_e2e_sales_success_4c9c04755904459bba454f3edc4a0120	2026-10-31 13:36:30.173	2026-10-31 13:36:30.233
cmvwg4nvo000e14ozn0cmagxh	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_sales_success_76727966456547758e6f567b024f8d91	gst-e2e-success-gst_e2e_sales_success_76727966456547758e6f567b024f8d91	ae267b32073c2188fddd72f59af2ff90f73da209acc8b957f5f8c4e6a5c1b751	COMPLETED	DRAFT-024f8d91	gst_e2e_sales_success_76727966456547758e6f567b024f8d91	2026-10-31 13:37:51.588	2026-10-31 13:37:51.63
cmvwg6ghx000ekez5amjf5ng8	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_sales_success_9e5c4bd6a06442659dae4570dd904250	gst-e2e-success-gst_e2e_sales_success_9e5c4bd6a06442659dae4570dd904250	96b26946c6ba5f84420e364fce30282690713c812f3b464abd678598a694e9c0	COMPLETED	DRAFT-dd904250	gst_e2e_sales_success_9e5c4bd6a06442659dae4570dd904250	2026-10-31 13:39:15.333	2026-10-31 13:39:15.377
cmvwg817l000eemkishtbqj2h	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_sales_success_861a943099ab401896b2cf2663424588	gst-e2e-success-gst_e2e_sales_success_861a943099ab401896b2cf2663424588	b098f180c202e4a40b297f2029214f021e55cb8069bba375047f8dbba617f7ff	COMPLETED	DRAFT-63424588	gst_e2e_sales_success_861a943099ab401896b2cf2663424588	2026-10-31 13:40:28.833	2026-10-31 13:40:28.88
cmvwg9m7z000edaac97uz5xz5	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_sales_success_ad360a6411064d099a18d08fa4bf62c4	gst-e2e-success-gst_e2e_sales_success_ad360a6411064d099a18d08fa4bf62c4	13eecf53b284dac00d3ecf6fe9178113614144082e617083f749346b36ebdf8e	COMPLETED	DRAFT-a4bf62c4	gst_e2e_sales_success_ad360a6411064d099a18d08fa4bf62c4	2026-10-31 13:41:42.719	2026-10-31 13:41:42.777
cmvwgb6fp000evg918yq79lc6	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_sales_success_b3d1b8d7803746e8a34a24ada270c41d	gst-e2e-success-gst_e2e_sales_success_b3d1b8d7803746e8a34a24ada270c41d	b9d61fc0bf07a30609cd981e19ade8b20f59f6fe22eab89f09e2f0fab5335351	COMPLETED	DRAFT-a270c41d	gst_e2e_sales_success_b3d1b8d7803746e8a34a24ada270c41d	2026-10-31 13:42:55.573	2026-10-31 13:42:55.645
cmvwgd9q7000eeteskoofrti5	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_sales_success_e95ec457a9c74f97be29242a8011148c	gst-e2e-success-gst_e2e_sales_success_e95ec457a9c74f97be29242a8011148c	40f4bba6e8394e7f2054d05fe0c6bc0af4e56661a0c2fc36f9c95820d347d08d	COMPLETED	DRAFT-8011148c	gst_e2e_sales_success_e95ec457a9c74f97be29242a8011148c	2026-10-31 13:44:33.151	2026-10-31 13:44:33.214
cmvwgerc40002payc9j6zrueu	q10-app-1793454341866-tenant	q10-app-1793454341866-invoice-0	q10-app-1793454341866-same-key	ef4083c7e26aea749069bebcb532c644845064b52e82e7a116a15f92ce9cf357	COMPLETED	q10-app-1793454341866-draft-0	q10-app-1793454341866-invoice-0	2026-10-31 13:45:42.628	2026-10-31 13:45:42.703
cmvwges0h000epayc5q3t06fb	q10-app-1793454341866-tenant	q10-app-1793454341866-invoice-1	q10-app-1793454341866-concurrent	fa03878333657761ab79678bff7e7caa5e09d657e91cb3f2aadbeef427f0abf6	COMPLETED	q10-app-1793454341866-draft-1	q10-app-1793454341866-invoice-1	2026-10-31 13:45:43.506	2026-10-31 13:45:43.585
cmvwgg76z00022ruv37g6eqn2	q10-app-1793454409161-tenant	q10-app-1793454409161-invoice-0	q10-app-1793454409161-same-key	a139a6ec2c575a589541002a021176f4722b26dabdc78e1b2738b8cc17623338	COMPLETED	q10-app-1793454409161-draft-0	q10-app-1793454409161-invoice-0	2026-10-31 13:46:49.835	2026-10-31 13:46:49.912
cmvwgg7sz000e2ruvhkc15spz	q10-app-1793454409161-tenant	q10-app-1793454409161-invoice-1	q10-app-1793454409161-concurrent	da8518145d9b19cd9c725876993bf855ea0e666338fa4e4219bacc4e5771c95e	COMPLETED	q10-app-1793454409161-draft-1	q10-app-1793454409161-invoice-1	2026-10-31 13:46:50.627	2026-10-31 13:46:50.679
cmvwghz5q0002jrg0u52oc3q2	q10-app-1793454491946-tenant	q10-app-1793454491946-invoice-0	q10-app-1793454491946-same-key	c73b6186738638b330bcf0771faf6a3ddc7bcdedbad2ab4b8bea4655210ca13b	COMPLETED	q10-app-1793454491946-draft-0	q10-app-1793454491946-invoice-0	2026-10-31 13:48:12.735	2026-10-31 13:48:12.784
cmvwghzhj000ejrg0zlpwvlo7	q10-app-1793454491946-tenant	q10-app-1793454491946-invoice-1	q10-app-1793454491946-concurrent	778f15c6583d3403ace8045135802e05aec62cfef3b3d8a3a92303ccdc53f537	COMPLETED	q10-app-1793454491946-draft-1	q10-app-1793454491946-invoice-1	2026-10-31 13:48:13.159	2026-10-31 13:48:13.221
\.


--
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stock_movements (id, tenant_id, product_id, batch_id, movement_type, quantity_delta, reference_type, reference_id, unit_rate, notes, created_by, created_at) FROM stdin;
q10-q14-1793420220210-063bc8e0-2228-4417-bca5-a697dfa33383	q10-q14-1793420220210-a-tenant	q10-q14-1793420220210-a-product	q10-q14-1793420220210-a-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793420220210-a-invoice	100.00	\N	q10-q14-1793420220210-a-user	2026-10-31 04:17:00.344
q10-q14-1793420220210-ce224349-a6c5-455c-903d-bf787b876a09	q10-q14-1793420220210-concurrent-tenant	q10-q14-1793420220210-concurrent-product	q10-q14-1793420220210-concurrent-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793420220210-concurrent-invoice	100.00	\N	q10-q14-1793420220210-concurrent-user	2026-10-31 04:17:00.46
q10-q14-1793420355327-0089c7dc-ff1c-48ae-9669-3b0ca3e3f2e4	q10-q14-1793420355327-a-tenant	q10-q14-1793420355327-a-product	q10-q14-1793420355327-a-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793420355327-a-invoice	100.00	\N	q10-q14-1793420355327-a-user	2026-10-31 04:19:15.443
q10-q14-1793420355327-1cb5c1db-efff-48a3-9d6d-be7ddc07b849	q10-q14-1793420355327-uncertain-tenant	q10-q14-1793420355327-uncertain-product	q10-q14-1793420355327-uncertain-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793420355327-uncertain-invoice	100.00	\N	q10-q14-1793420355327-uncertain-user	2026-10-31 04:19:15.485
q10-q14-1793420355327-e9b8126f-abe6-43b0-824b-c0df0e7c4544	q10-q14-1793420355327-concurrent-tenant	q10-q14-1793420355327-concurrent-product	q10-q14-1793420355327-concurrent-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793420355327-concurrent-invoice	100.00	\N	q10-q14-1793420355327-concurrent-user	2026-10-31 04:19:15.557
q10-q14-1793420355327-d069f5b2-4539-49a3-9382-47a112414bf5	q10-q14-1793420355327-conflicting-tenant	q10-q14-1793420355327-conflicting-product	q10-q14-1793420355327-conflicting-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793420355327-conflicting-invoice	100.00	\N	q10-q14-1793420355327-conflicting-user	2026-10-31 04:19:15.591
q10-q14-1793421051032-583034f8-0451-495c-8f24-cb9e08bdba28	q10-q14-1793421051032-a-tenant	q10-q14-1793421051032-a-product	q10-q14-1793421051032-a-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421051032-a-invoice	100.00	\N	q10-q14-1793421051032-a-user	2026-10-31 04:30:51.303
q10-q14-1793421051032-c1c59bf1-1ac4-4dca-9101-035ecf5ac2d0	q10-q14-1793421051032-uncertain-tenant	q10-q14-1793421051032-uncertain-product	q10-q14-1793421051032-uncertain-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421051032-uncertain-invoice	100.00	\N	q10-q14-1793421051032-uncertain-user	2026-10-31 04:30:51.411
q10-q14-1793421051032-a3599a46-9c19-40be-9fb8-4b8603a5f5a9	q10-q14-1793421051032-concurrent-tenant	q10-q14-1793421051032-concurrent-product	q10-q14-1793421051032-concurrent-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421051032-concurrent-invoice	100.00	\N	q10-q14-1793421051032-concurrent-user	2026-10-31 04:30:51.574
q10-q14-1793421051032-40aef9bc-16d9-4574-a9b4-568bcc11de4f	q10-q14-1793421051032-conflicting-tenant	q10-q14-1793421051032-conflicting-product	q10-q14-1793421051032-conflicting-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421051032-conflicting-invoice	100.00	\N	q10-q14-1793421051032-conflicting-user	2026-10-31 04:30:51.639
q10-q14-1793421102644-5a8a75aa-2f79-48f4-aa3c-d3c58bcfc4b2	q10-q14-1793421102644-a-tenant	q10-q14-1793421102644-a-product	q10-q14-1793421102644-a-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421102644-a-invoice	100.00	\N	q10-q14-1793421102644-a-user	2026-10-31 04:31:42.794
q10-q14-1793421102644-67a2e548-85aa-446c-8a0a-4fe98b83ed06	q10-q14-1793421102644-uncertain-tenant	q10-q14-1793421102644-uncertain-product	q10-q14-1793421102644-uncertain-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421102644-uncertain-invoice	100.00	\N	q10-q14-1793421102644-uncertain-user	2026-10-31 04:31:42.839
q10-q14-1793421102644-8e6b59f5-407d-4845-843b-ac496c4cfa30	q10-q14-1793421102644-concurrent-tenant	q10-q14-1793421102644-concurrent-product	q10-q14-1793421102644-concurrent-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421102644-concurrent-invoice	100.00	\N	q10-q14-1793421102644-concurrent-user	2026-10-31 04:31:42.912
q10-q14-1793421102644-5b4f761e-aea3-49fe-8c82-7597831fda94	q10-q14-1793421102644-conflicting-tenant	q10-q14-1793421102644-conflicting-product	q10-q14-1793421102644-conflicting-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421102644-conflicting-invoice	100.00	\N	q10-q14-1793421102644-conflicting-user	2026-10-31 04:31:42.946
q10-q14-1793421202430-42ae771c-4928-4366-90ca-fed0bba5fd0c	q10-q14-1793421202430-a-tenant	q10-q14-1793421202430-a-product	q10-q14-1793421202430-a-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421202430-a-invoice	100.00	\N	q10-q14-1793421202430-a-user	2026-10-31 04:33:22.648
q10-q14-1793421202430-17222e4b-651b-4323-ad9f-c90ddaddfbef	q10-q14-1793421202430-uncertain-tenant	q10-q14-1793421202430-uncertain-product	q10-q14-1793421202430-uncertain-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421202430-uncertain-invoice	100.00	\N	q10-q14-1793421202430-uncertain-user	2026-10-31 04:33:22.728
q10-q14-1793421202430-2af4cfdb-0c4e-4dd2-9076-d7a3b46858b4	q10-q14-1793421202430-concurrent-tenant	q10-q14-1793421202430-concurrent-product	q10-q14-1793421202430-concurrent-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421202430-concurrent-invoice	100.00	\N	q10-q14-1793421202430-concurrent-user	2026-10-31 04:33:22.85
q10-q14-1793421202430-237ac658-03b0-4ccf-990f-13709780fc0c	q10-q14-1793421202430-conflicting-tenant	q10-q14-1793421202430-conflicting-product	q10-q14-1793421202430-conflicting-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421202430-conflicting-invoice	100.00	\N	q10-q14-1793421202430-conflicting-user	2026-10-31 04:33:22.906
cmvvwsib8000420j6bsk3mt8s	q10-q14-1793421202430-rollback-tenant	q10-q14-1793421202430-rollback-product	q10-q14-1793421202430-rollback-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421202430-rollback-invoice	100.00	\N	q10-q14-1793421202430-rollback-user	2026-10-31 04:36:31.795
q10-q14-1793421457888-69616376-4c72-4cd8-b84a-648be4be9e56	q10-q14-1793421457888-a-tenant	q10-q14-1793421457888-a-product	q10-q14-1793421457888-a-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421457888-a-invoice	100.00	\N	q10-q14-1793421457888-a-user	2026-10-31 04:37:38.059
q10-q14-1793421457888-04117d39-5269-4d4f-b1f6-970054643df9	q10-q14-1793421457888-uncertain-tenant	q10-q14-1793421457888-uncertain-product	q10-q14-1793421457888-uncertain-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421457888-uncertain-invoice	100.00	\N	q10-q14-1793421457888-uncertain-user	2026-10-31 04:37:38.114
q10-q14-1793421457888-d79b182e-db26-40e5-93e6-f4b96a1e3f07	q10-q14-1793421457888-concurrent-tenant	q10-q14-1793421457888-concurrent-product	q10-q14-1793421457888-concurrent-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421457888-concurrent-invoice	100.00	\N	q10-q14-1793421457888-concurrent-user	2026-10-31 04:37:38.198
q10-q14-1793421457888-00f76148-8c37-4427-87c8-8024a863d7e7	q10-q14-1793421457888-conflicting-tenant	q10-q14-1793421457888-conflicting-product	q10-q14-1793421457888-conflicting-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421457888-conflicting-invoice	100.00	\N	q10-q14-1793421457888-conflicting-user	2026-10-31 04:37:38.233
cmvvwtxu3000413ymerwa073s	q10-q14-1793421457888-b-tenant	q10-q14-1793421457888-b-product	q10-q14-1793421457888-b-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421457888-b-invoice	100.00	\N	q10-q14-1793421457888-b-user	2026-10-31 04:37:38.57
cmvvwvja50004d1y28egkj0cw	q10-q14-1793421457888-rollback-tenant	q10-q14-1793421457888-rollback-product	q10-q14-1793421457888-rollback-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421457888-rollback-invoice	100.00	\N	q10-q14-1793421457888-rollback-user	2026-10-31 04:38:53.02
cmvvwx1np0004zg7xs71ir9zq	q10-q14-1793421202430-b-tenant	q10-q14-1793421202430-b-product	q10-q14-1793421202430-b-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421202430-b-invoice	100.00	\N	q10-q14-1793421202430-b-user	2026-10-31 04:40:03.491
cmvvwzw010004docnf7ptb8xz	q10-q14-1793421102644-rollback-tenant	q10-q14-1793421102644-rollback-product	q10-q14-1793421102644-rollback-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421102644-rollback-invoice	100.00	\N	q10-q14-1793421102644-rollback-user	2026-10-31 04:42:16.128
cmvvwzw2h000fdocnt67c6ae0	q10-q14-1793421102644-b-tenant	q10-q14-1793421102644-b-product	q10-q14-1793421102644-b-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421102644-b-invoice	100.00	\N	q10-q14-1793421102644-b-user	2026-10-31 04:42:16.216
cmvvx2pri00049hdlom86qp7v	q10-q14-1793421051032-rollback-tenant	q10-q14-1793421051032-rollback-product	q10-q14-1793421051032-rollback-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421051032-rollback-invoice	100.00	\N	q10-q14-1793421051032-rollback-user	2026-10-31 04:44:28.013
cmvvx2ptj000f9hdlk6g23zcb	q10-q14-1793421051032-b-tenant	q10-q14-1793421051032-b-product	q10-q14-1793421051032-b-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421051032-b-invoice	100.00	\N	q10-q14-1793421051032-b-user	2026-10-31 04:44:28.087
q10-q14-1793421934870-3b2884e9-74b7-4319-a9f8-510a59bce868	q10-q14-1793421934870-a-tenant	q10-q14-1793421934870-a-product	q10-q14-1793421934870-a-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421934870-a-invoice	100.00	\N	q10-q14-1793421934870-a-user	2026-10-31 04:45:34.968
q10-q14-1793421934870-6c88b556-e360-4911-9501-c3b1ce3d0400	q10-q14-1793421934870-uncertain-tenant	q10-q14-1793421934870-uncertain-product	q10-q14-1793421934870-uncertain-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421934870-uncertain-invoice	100.00	\N	q10-q14-1793421934870-uncertain-user	2026-10-31 04:45:34.994
q10-q14-1793421934870-0274e6dc-aa31-4806-b695-f3409184f586	q10-q14-1793421934870-concurrent-tenant	q10-q14-1793421934870-concurrent-product	q10-q14-1793421934870-concurrent-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421934870-concurrent-invoice	100.00	\N	q10-q14-1793421934870-concurrent-user	2026-10-31 04:45:35.038
q10-q14-1793421934870-7fd160ab-4d32-4538-9c30-c9b929b06ec8	q10-q14-1793421934870-conflicting-tenant	q10-q14-1793421934870-conflicting-product	q10-q14-1793421934870-conflicting-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421934870-conflicting-invoice	100.00	\N	q10-q14-1793421934870-conflicting-user	2026-10-31 04:45:35.058
cmvvx45zy00044b8gioa6k3zz	q10-q14-1793421934870-rollback-tenant	q10-q14-1793421934870-rollback-product	q10-q14-1793421934870-rollback-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421934870-rollback-invoice	100.00	\N	q10-q14-1793421934870-rollback-user	2026-10-31 04:45:35.709
cmvvx4619000f4b8g2n7qmmj8	q10-q14-1793421934870-b-tenant	q10-q14-1793421934870-b-product	q10-q14-1793421934870-b-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793421934870-b-invoice	100.00	\N	q10-q14-1793421934870-b-user	2026-10-31 04:45:35.756
q10-q14-1793428172549-90ec7d3e-f59d-46d5-ad16-53db84e02716	q10-q14-1793428172549-a-tenant	q10-q14-1793428172549-a-product	q10-q14-1793428172549-a-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793428172549-a-invoice	100.00	\N	q10-q14-1793428172549-a-user	2026-10-31 06:29:32.77
q10-q14-1793428172549-3b5d38f9-75a3-456b-ba06-762733030cef	q10-q14-1793428172549-uncertain-tenant	q10-q14-1793428172549-uncertain-product	q10-q14-1793428172549-uncertain-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793428172549-uncertain-invoice	100.00	\N	q10-q14-1793428172549-uncertain-user	2026-10-31 06:29:32.842
q10-q14-1793428172549-cbec6c7e-3241-445c-8de4-29bb706ea399	q10-q14-1793428172549-concurrent-tenant	q10-q14-1793428172549-concurrent-product	q10-q14-1793428172549-concurrent-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793428172549-concurrent-invoice	100.00	\N	q10-q14-1793428172549-concurrent-user	2026-10-31 06:29:32.962
q10-q14-1793428172549-19b5d3c9-d686-4758-9d78-5db8a4f3b2fd	q10-q14-1793428172549-conflicting-tenant	q10-q14-1793428172549-conflicting-product	q10-q14-1793428172549-conflicting-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793428172549-conflicting-invoice	100.00	\N	q10-q14-1793428172549-conflicting-user	2026-10-31 06:29:33.014
q10-q14-1793428213936-e6d58d20-7c45-4949-a314-3724dade2da0	q10-q14-1793428213936-a-tenant	q10-q14-1793428213936-a-product	q10-q14-1793428213936-a-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793428213936-a-invoice	100.00	\N	q10-q14-1793428213936-a-user	2026-10-31 06:30:14.11
q10-q14-1793428213936-f395c295-9134-4f87-84e7-25c5e1e107a5	q10-q14-1793428213936-uncertain-tenant	q10-q14-1793428213936-uncertain-product	q10-q14-1793428213936-uncertain-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793428213936-uncertain-invoice	100.00	\N	q10-q14-1793428213936-uncertain-user	2026-10-31 06:30:14.16
q10-q14-1793428213936-98248d08-a94c-4486-9e0a-e05d8ac5a438	q10-q14-1793428213936-concurrent-tenant	q10-q14-1793428213936-concurrent-product	q10-q14-1793428213936-concurrent-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793428213936-concurrent-invoice	100.00	\N	q10-q14-1793428213936-concurrent-user	2026-10-31 06:30:14.246
q10-q14-1793428213936-743f0e13-64f3-42c7-88ee-41370dbb5b11	q10-q14-1793428213936-conflicting-tenant	q10-q14-1793428213936-conflicting-product	q10-q14-1793428213936-conflicting-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793428213936-conflicting-invoice	100.00	\N	q10-q14-1793428213936-conflicting-user	2026-10-31 06:30:14.284
cmvwazxjz0004ujqz1x6st8wg	q10-q14-1793428213936-rollback-tenant	q10-q14-1793428213936-rollback-product	q10-q14-1793428213936-rollback-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793428213936-rollback-invoice	100.00	\N	q10-q14-1793428213936-rollback-user	2026-10-31 11:14:12.766
cmvwazxli000fujqzxqsynh5c	q10-q14-1793428213936-b-tenant	q10-q14-1793428213936-b-product	q10-q14-1793428213936-b-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793428213936-b-invoice	100.00	\N	q10-q14-1793428213936-b-user	2026-10-31 11:14:12.821
cmvwbfxnz0004xur64s1dteos	q10-q14-1793428172549-rollback-tenant	q10-q14-1793428172549-rollback-product	q10-q14-1793428172549-rollback-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793428172549-rollback-invoice	100.00	\N	q10-q14-1793428172549-rollback-user	2026-10-31 11:26:39.406
cmvwbkhr10004t34w3te8xj79	q10-q14-1793428172549-b-tenant	q10-q14-1793428172549-b-product	q10-q14-1793428172549-b-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793428172549-b-invoice	100.00	\N	q10-q14-1793428172549-b-user	2026-10-31 11:30:12.061
cmvwbm3gx0004a8p2jcfwyim9	q10-app-1793446286377-tenant	q10-app-1793446286377-product	q10-app-1793446286377-batch	SALE_OUT	-1	sales_invoice	q10-app-1793446286377-invoice-0	100.00	\N	q10-app-1793446286377-user	2026-10-31 11:31:26.865
cmvwbm3rz000ga8p213xfv3tm	q10-app-1793446286377-tenant	q10-app-1793446286377-product	q10-app-1793446286377-batch	SALE_OUT	-1	sales_invoice	q10-app-1793446286377-invoice-1	100.00	\N	q10-app-1793446286377-user	2026-10-31 11:31:27.262
cmvwbqfyl0004ic7xkaknrc0f	q10-app-1793446489184-tenant	q10-app-1793446489184-product	q10-app-1793446489184-batch	SALE_OUT	-1	sales_invoice	q10-app-1793446489184-invoice-0	100.00	\N	q10-app-1793446489184-user	2026-10-31 11:34:49.676
cmvwbqg99000gic7xg85qsnfe	q10-app-1793446489184-tenant	q10-app-1793446489184-product	q10-app-1793446489184-batch	SALE_OUT	-1	sales_invoice	q10-app-1793446489184-invoice-1	100.00	\N	q10-app-1793446489184-user	2026-10-31 11:34:50.06
cmvwbtbf10004kljeecq8c3mh	q10-app-1793446623070-tenant	q10-app-1793446623070-product	q10-app-1793446623070-batch	SALE_OUT	-1	sales_invoice	q10-app-1793446623070-invoice-0	100.00	\N	q10-app-1793446623070-user	2026-10-31 11:37:03.756
cmvwbtbq1000ikljeeczrmanz	q10-app-1793446623070-tenant	q10-app-1793446623070-product	q10-app-1793446623070-batch	SALE_OUT	-1	sales_invoice	q10-app-1793446623070-invoice-1	100.00	\N	q10-app-1793446623070-user	2026-10-31 11:37:04.152
q10-q14-1793446761696-5741feb8-a321-4a99-9ff0-974e3e31583b	q10-q14-1793446761696-a-tenant	q10-q14-1793446761696-a-product	q10-q14-1793446761696-a-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793446761696-a-invoice	100.00	\N	q10-q14-1793446761696-a-user	2026-10-31 11:39:21.851
q10-q14-1793446761696-e550d231-1836-4b51-8197-b8dea74bf2c6	q10-q14-1793446761696-uncertain-tenant	q10-q14-1793446761696-uncertain-product	q10-q14-1793446761696-uncertain-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793446761696-uncertain-invoice	100.00	\N	q10-q14-1793446761696-uncertain-user	2026-10-31 11:39:21.891
q10-q14-1793446761696-2b06f588-60d5-458d-aae9-e9711a90b7af	q10-q14-1793446761696-concurrent-tenant	q10-q14-1793446761696-concurrent-product	q10-q14-1793446761696-concurrent-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793446761696-concurrent-invoice	100.00	\N	q10-q14-1793446761696-concurrent-user	2026-10-31 11:39:21.967
q10-q14-1793446761696-1d7c7056-2fb5-4cb1-a1c5-9c48aee2aa0d	q10-q14-1793446761696-conflicting-tenant	q10-q14-1793446761696-conflicting-product	q10-q14-1793446761696-conflicting-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793446761696-conflicting-invoice	100.00	\N	q10-q14-1793446761696-conflicting-user	2026-10-31 11:39:22.009
cmvwcec3s00045hht14b138vk	q10-app-1793447603960-tenant	q10-app-1793447603960-product	q10-app-1793447603960-batch	SALE_OUT	-1	sales_invoice	q10-app-1793447603960-invoice-0	100.00	\N	q10-app-1793447603960-user	2026-10-31 11:53:24.424
cmvwcecef000g5hht1qg0iwzn	q10-app-1793447603960-tenant	q10-app-1793447603960-product	q10-app-1793447603960-batch	SALE_OUT	-1	sales_invoice	q10-app-1793447603960-invoice-1	100.00	\N	q10-app-1793447603960-user	2026-10-31 11:53:24.807
q10-q14-1793447682627-918b140e-1d90-461c-af6c-c16981f00ff7	q10-q14-1793447682627-a-tenant	q10-q14-1793447682627-a-product	q10-q14-1793447682627-a-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793447682627-a-invoice	100.00	\N	q10-q14-1793447682627-a-user	2026-10-31 11:54:42.794
q10-q14-1793447682627-e8f1ebb5-f0c7-439f-9787-d48d6cbaf3a7	q10-q14-1793447682627-uncertain-tenant	q10-q14-1793447682627-uncertain-product	q10-q14-1793447682627-uncertain-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793447682627-uncertain-invoice	100.00	\N	q10-q14-1793447682627-uncertain-user	2026-10-31 11:54:42.838
q10-q14-1793447682627-17a3a6dd-d28c-46bd-b469-b0659b1ea6c1	q10-q14-1793447682627-concurrent-tenant	q10-q14-1793447682627-concurrent-product	q10-q14-1793447682627-concurrent-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793447682627-concurrent-invoice	100.00	\N	q10-q14-1793447682627-concurrent-user	2026-10-31 11:54:42.915
q10-q14-1793447682627-767441fa-87cd-40d7-812a-bca5399b63cb	q10-q14-1793447682627-conflicting-tenant	q10-q14-1793447682627-conflicting-product	q10-q14-1793447682627-conflicting-batch	SALE_OUT	-1	sales_invoice	q10-q14-1793447682627-conflicting-invoice	100.00	\N	q10-q14-1793447682627-conflicting-user	2026-10-31 11:54:42.947
cmvwfjgfd0004nht7rzd3qysf	q10-app-1793452881250-tenant	q10-app-1793452881250-product	q10-app-1793452881250-batch	SALE_OUT	-1	sales_invoice	q10-app-1793452881250-invoice-0	100.00	\N	q10-app-1793452881250-user	2026-10-31 13:21:22.153
cmvwfjgrw000gnht78pz6t7lg	q10-app-1793452881250-tenant	q10-app-1793452881250-product	q10-app-1793452881250-batch	SALE_OUT	-1	sales_invoice	q10-app-1793452881250-invoice-1	100.00	\N	q10-app-1793452881250-user	2026-10-31 13:21:22.603
cmvwfp7xs0004axymla5q1tkm	q10-app-1793453149906-tenant	q10-app-1793453149906-product	q10-app-1793453149906-batch	SALE_OUT	-1	sales_invoice	q10-app-1793453149906-invoice-0	100.00	\N	q10-app-1793453149906-user	2026-10-31 13:25:51.087
cmvwfp8cl000gaxym9mlhxtib	q10-app-1793453149906-tenant	q10-app-1793453149906-product	q10-app-1793453149906-batch	SALE_OUT	-1	sales_invoice	q10-app-1793453149906-invoice-1	100.00	\N	q10-app-1793453149906-user	2026-10-31 13:25:51.62
cmvwfy2sa000g99yrrn31re25	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	gst_e2e_product_a_1734ed203ca1435e8582715750964b0d	gst_e2e_batch_a_7f0ebdf726714100818eeeb28ae29d42	SALE_OUT	-1	sales_invoice	gst_e2e_sales_success_c9722d460e8a47f6916e516454354bd4	100.00	\N	gst_e2e_user_1e3d6dc3e3af44828ea74a666498c4b3	2026-10-31 13:32:44.313
cmvwfzn88000gza3tdofplkos	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_product_a_fdf4a40153c5437a9ecb579368dedc61	gst_e2e_batch_a_8d53732f280d48a3aa1987840e67dfe8	SALE_OUT	-1	sales_invoice	gst_e2e_sales_success_0708541c7aef4e43a298df5fa0fa77e1	100.00	\N	gst_e2e_user_c9bcf582e8ec42a29706c6758a4c5227	2026-10-31 13:33:57.463
cmvwfznd6000rza3tek8nxg7s	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_product_a_fdf4a40153c5437a9ecb579368dedc61	cmvwfzncv000pza3tjjfzum1p	PURCHASE_IN	2	purchase_invoice	gst_e2e_purchase_success_ce69ce80a135405083eb65af66d4e5d2	50.00	\N	gst_e2e_user_c9bcf582e8ec42a29706c6758a4c5227	2026-10-31 13:33:57.641
cmvwg17s6000glgotjdf01t8a	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_product_a_30bbee97d538445f8ca1dcf448323e54	gst_e2e_batch_a_4e3d69037d3c45adb857a9ddf01dcdd6	SALE_OUT	-1	sales_invoice	gst_e2e_sales_success_afdbc6d5a3564cca92e3383e1fbd7e74	100.00	\N	gst_e2e_user_6c87a7d4a4cf4788828673be1bf2844b	2026-10-31 13:35:10.757
cmvwg17y0000rlgot1aai80iv	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_product_a_30bbee97d538445f8ca1dcf448323e54	cmvwg17xh000plgotj8wajsbk	PURCHASE_IN	2	purchase_invoice	gst_e2e_purchase_success_53face98828d459ea964e6ea9de2adb0	50.00	\N	gst_e2e_user_6c87a7d4a4cf4788828673be1bf2844b	2026-10-31 13:35:10.966
cmvwg2x2z000g2plhfy3vjr7h	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_product_a_85f2971d05db4af59a4e72f1bcd81079	gst_e2e_batch_a_055b24662b594ebbaad6796af3c631d3	SALE_OUT	-1	sales_invoice	gst_e2e_sales_success_4c9c04755904459bba454f3edc4a0120	100.00	\N	gst_e2e_user_f0e91ddf6de143cca30b52d49086168a	2026-10-31 13:36:30.202
cmvwg2x7g000r2plhdl6bhqfu	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_product_a_85f2971d05db4af59a4e72f1bcd81079	cmvwg2x76000p2plh2w0cy4qg	PURCHASE_IN	2	purchase_invoice	gst_e2e_purchase_success_396c53317f354bc18e427271a7ab8604	50.00	\N	gst_e2e_user_f0e91ddf6de143cca30b52d49086168a	2026-10-31 13:36:30.363
cmvwg4nw9000g14ozpwsib6b6	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_product_a_799cb53d442f4628a904adc8b69291aa	gst_e2e_batch_a_bfebe928dd1942f5a8218a899c782443	SALE_OUT	-1	sales_invoice	gst_e2e_sales_success_76727966456547758e6f567b024f8d91	100.00	\N	gst_e2e_user_eed392649bbe46f59b199bee1f03c7e6	2026-10-31 13:37:51.608
cmvwg4nzt000r14ozcjkwskj4	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_product_a_799cb53d442f4628a904adc8b69291aa	cmvwg4nzl000p14oz9y8yh7qt	PURCHASE_IN	2	purchase_invoice	gst_e2e_purchase_success_1f164fb2783447d69f85f7df093931fa	50.00	\N	gst_e2e_user_eed392649bbe46f59b199bee1f03c7e6	2026-10-31 13:37:51.736
cmvwg6gif000gkez5369gtuor	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_product_a_7473b483cbdd42bb9b764d186206acd7	gst_e2e_batch_a_0d21bfc815624b91bc873ec459211eb4	SALE_OUT	-1	sales_invoice	gst_e2e_sales_success_9e5c4bd6a06442659dae4570dd904250	100.00	\N	gst_e2e_user_543643bc2f9f43bd8fe5cbdaff72cbef	2026-10-31 13:39:15.35
cmvwg6glx000rkez5nkpy3vx9	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_product_a_7473b483cbdd42bb9b764d186206acd7	cmvwg6glq000pkez52eq7noht	PURCHASE_IN	2	purchase_invoice	gst_e2e_purchase_success_f29700e5a951456bb04d6db56b016c68	50.00	\N	gst_e2e_user_543643bc2f9f43bd8fe5cbdaff72cbef	2026-10-31 13:39:15.476
cmvwg8187000gemkisnnc0gc0	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_product_a_ae05cfb72eaa42aabcc0996a8359d276	gst_e2e_batch_a_5e7293740c3d4610959494eb1f4ff8ca	SALE_OUT	-1	sales_invoice	gst_e2e_sales_success_861a943099ab401896b2cf2663424588	100.00	\N	gst_e2e_user_3df03d91d95a4aa193cd6d6b5b63d29f	2026-10-31 13:40:28.855
cmvwg81c5000remkihq2ff1xs	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_product_a_ae05cfb72eaa42aabcc0996a8359d276	cmvwg81bw000pemkispmxctm3	PURCHASE_IN	2	purchase_invoice	gst_e2e_purchase_success_d51c27ab43b145f195d586fed5ac6f01	50.00	\N	gst_e2e_user_3df03d91d95a4aa193cd6d6b5b63d29f	2026-10-31 13:40:28.997
cmvwg9m8u000gdaac7zuvgdy7	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_product_a_c5b641f60f2b47f78bedf11520bf4bf8	gst_e2e_batch_a_2079e4168b6644e483d0ccb93a2cea38	SALE_OUT	-1	sales_invoice	gst_e2e_sales_success_ad360a6411064d099a18d08fa4bf62c4	100.00	\N	gst_e2e_user_24a2027af5904578b7fcdaab60fcb210	2026-10-31 13:41:42.749
cmvwg9md2000rdaacenshvyfw	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_product_a_c5b641f60f2b47f78bedf11520bf4bf8	cmvwg9mcv000pdaach39l4l6d	PURCHASE_IN	2	purchase_invoice	gst_e2e_purchase_success_aaefa95e91204a878b000841573921e3	50.00	\N	gst_e2e_user_24a2027af5904578b7fcdaab60fcb210	2026-10-31 13:41:42.901
cmvwgb6go000gvg91sj9so378	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_product_a_90580835eb21424b947a18e5b7a00cf0	gst_e2e_batch_a_2655efbb72c642a28d13d5b546923cb4	SALE_OUT	-1	sales_invoice	gst_e2e_sales_success_b3d1b8d7803746e8a34a24ada270c41d	100.00	\N	gst_e2e_user_62a1702e07e74656821fa5094b20b72d	2026-10-31 13:42:55.607
cmvwgb6lj000rvg91bgav315t	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_product_a_90580835eb21424b947a18e5b7a00cf0	cmvwgb6l9000pvg91w2h19iw0	PURCHASE_IN	2	purchase_invoice	gst_e2e_purchase_success_b47ae86c87784e399a738d3dc2c10eac	50.00	\N	gst_e2e_user_62a1702e07e74656821fa5094b20b72d	2026-10-31 13:42:55.783
cmvwgd9r3000getesusr1c7ls	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_product_a_f2815984af604069a7e49a67c2a505ec	gst_e2e_batch_a_abd9959e4d974a6b8d27f59e65d46f46	SALE_OUT	-1	sales_invoice	gst_e2e_sales_success_e95ec457a9c74f97be29242a8011148c	100.00	\N	gst_e2e_user_b50dbb92d78b45a9947a6a5e5df0cad0	2026-10-31 13:44:33.182
cmvwgd9wk000retes1mi72pzn	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_product_a_f2815984af604069a7e49a67c2a505ec	cmvwgd9wa000petespr4ealpu	PURCHASE_IN	2	purchase_invoice	gst_e2e_purchase_success_f1dc1040426446d1986b7570aedcf581	50.00	\N	gst_e2e_user_b50dbb92d78b45a9947a6a5e5df0cad0	2026-10-31 13:44:33.379
cmvwgerda0004payc6xv8myk0	q10-app-1793454341866-tenant	q10-app-1793454341866-product	q10-app-1793454341866-batch	SALE_OUT	-1	sales_invoice	q10-app-1793454341866-invoice-0	100.00	\N	q10-app-1793454341866-user	2026-10-31 13:45:42.67
cmvwges1n000gpaycum9odgjh	q10-app-1793454341866-tenant	q10-app-1793454341866-product	q10-app-1793454341866-batch	SALE_OUT	-1	sales_invoice	q10-app-1793454341866-invoice-1	100.00	\N	q10-app-1793454341866-user	2026-10-31 13:45:43.546
cmvwgg78900042ruvyd6oxi31	q10-app-1793454409161-tenant	q10-app-1793454409161-product	q10-app-1793454409161-batch	SALE_OUT	-1	sales_invoice	q10-app-1793454409161-invoice-0	100.00	\N	q10-app-1793454409161-user	2026-10-31 13:46:49.88
cmvwgg7tr000g2ruvl33y41os	q10-app-1793454409161-tenant	q10-app-1793454409161-product	q10-app-1793454409161-batch	SALE_OUT	-1	sales_invoice	q10-app-1793454409161-invoice-1	100.00	\N	q10-app-1793454409161-user	2026-10-31 13:46:50.654
cmvwghz6k0004jrg0zdh7v6pe	q10-app-1793454491946-tenant	q10-app-1793454491946-product	q10-app-1793454491946-batch	SALE_OUT	-1	sales_invoice	q10-app-1793454491946-invoice-0	100.00	\N	q10-app-1793454491946-user	2026-10-31 13:48:12.764
cmvwghzif000gjrg0mj1dkj33	q10-app-1793454491946-tenant	q10-app-1793454491946-product	q10-app-1793454491946-batch	SALE_OUT	-1	sales_invoice	q10-app-1793454491946-invoice-1	100.00	\N	q10-app-1793454491946-user	2026-10-31 13:48:13.19
\.


--
-- Data for Name: supplier_ledgers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.supplier_ledgers (id, tenant_id, supplier_id, entry_type, debit, credit, balance, reference_type, reference_id, purchase_id, narration, entry_date, created_at) FROM stdin;
cmvwfzndu000tza3tbklm6h0b	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	gst_e2e_supplier_509a773065f1481795c14132bcdf8946	PURCHASE	0.00	118.00	243.00	purchase_invoice	gst_e2e_purchase_success_ce69ce80a135405083eb65af66d4e5d2	gst_e2e_purchase_success_ce69ce80a135405083eb65af66d4e5d2	Purchase DRAFT-66d4e5d2	2026-10-31 13:33:55.958	2026-10-31 13:33:57.665
cmvwg17z1000tlgotn75hswwf	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	gst_e2e_supplier_f57df7e735f3462bac1432e6082cf6d5	PURCHASE	0.00	118.00	243.00	purchase_invoice	gst_e2e_purchase_success_53face98828d459ea964e6ea9de2adb0	gst_e2e_purchase_success_53face98828d459ea964e6ea9de2adb0	Purchase DRAFT-9de2adb0	2026-10-31 13:35:09.31	2026-10-31 13:35:11.004
cmvwg2x7z000t2plhaiyolyll	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	gst_e2e_supplier_b480da5f573d495fb4e753482b2abe9e	PURCHASE	0.00	118.00	243.00	purchase_invoice	gst_e2e_purchase_success_396c53317f354bc18e427271a7ab8604	gst_e2e_purchase_success_396c53317f354bc18e427271a7ab8604	Purchase DRAFT-a7ab8604	2026-10-31 13:36:28.408	2026-10-31 13:36:30.383
cmvwg4o09000t14ozcln0gr0w	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	gst_e2e_supplier_c63b60377e9d4a8fa15e5396112df0f2	PURCHASE	0.00	118.00	243.00	purchase_invoice	gst_e2e_purchase_success_1f164fb2783447d69f85f7df093931fa	gst_e2e_purchase_success_1f164fb2783447d69f85f7df093931fa	Purchase DRAFT-093931fa	2026-10-31 13:37:50.384	2026-10-31 13:37:51.753
cmvwg6gmd000tkez5p371yib4	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	gst_e2e_supplier_f40058d4fa5446239501e43c0d3334ec	PURCHASE	0.00	118.00	243.00	purchase_invoice	gst_e2e_purchase_success_f29700e5a951456bb04d6db56b016c68	gst_e2e_purchase_success_f29700e5a951456bb04d6db56b016c68	Purchase DRAFT-6b016c68	2026-10-31 13:39:14.029	2026-10-31 13:39:15.492
cmvwg81cr000temkicv8xn0re	gst_e2e_tenant_19035406820a497699286f211ca126f6	gst_e2e_supplier_8b18212293a643b286fb03dcaf60f778	PURCHASE	0.00	118.00	243.00	purchase_invoice	gst_e2e_purchase_success_d51c27ab43b145f195d586fed5ac6f01	gst_e2e_purchase_success_d51c27ab43b145f195d586fed5ac6f01	Purchase DRAFT-d5ac6f01	2026-10-31 13:40:27.581	2026-10-31 13:40:29.018
cmvwg9mdi000tdaac8f8uzf6x	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_supplier_94e79b4473e043ff816317b0b593d282	PURCHASE	0.00	118.00	243.00	purchase_invoice	gst_e2e_purchase_success_aaefa95e91204a878b000841573921e3	gst_e2e_purchase_success_aaefa95e91204a878b000841573921e3	Purchase DRAFT-573921e3	2026-10-31 13:41:41.091	2026-10-31 13:41:42.917
cmvwg9mja0017daac67jdus4x	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	gst_e2e_supplier_94e79b4473e043ff816317b0b593d282	PAYMENT_MADE	40.00	0.00	203.00	payment_made	\N	\N	Payment made — Bank Transfer #GST-SUP-gst_e2e_purchase_success_aaefa95e91204a878b000841573921e3	2026-10-31 13:41:43.115	2026-10-31 13:41:43.124
cmvwgb6m5000tvg91z5jop9hh	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_supplier_056f63b10ffa45f5a326b206d1a237e2	PURCHASE	0.00	118.00	243.00	purchase_invoice	gst_e2e_purchase_success_b47ae86c87784e399a738d3dc2c10eac	gst_e2e_purchase_success_b47ae86c87784e399a738d3dc2c10eac	Purchase DRAFT-c2c10eac	2026-10-31 13:42:54.027	2026-10-31 13:42:55.805
cmvwgb6to0017vg91a8yn3s05	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	gst_e2e_supplier_056f63b10ffa45f5a326b206d1a237e2	PAYMENT_MADE	40.00	0.00	203.00	payment_made	\N	\N	Payment made — Bank Transfer #GST-SUP-gst_e2e_purchase_success_b47ae86c87784e399a738d3dc2c10eac	2026-10-31 13:42:56.063	2026-10-31 13:42:56.075
cmvwgd9x8000teteseofzmciw	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_supplier_61ddcc9df9ab450bbe6a88eef8d031d0	PURCHASE	0.00	118.00	243.00	purchase_invoice	gst_e2e_purchase_success_f1dc1040426446d1986b7570aedcf581	gst_e2e_purchase_success_f1dc1040426446d1986b7570aedcf581	Purchase DRAFT-aedcf581	2026-10-31 13:44:31.539	2026-10-31 13:44:33.403
cmvwgda5r0017etes8j9piv8r	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	gst_e2e_supplier_61ddcc9df9ab450bbe6a88eef8d031d0	PAYMENT_MADE	40.00	0.00	203.00	payment_made	\N	\N	Payment made — Bank Transfer #GST-SUP-gst_e2e_purchase_success_f1dc1040426446d1986b7570aedcf581	2026-10-31 13:44:33.697	2026-10-31 13:44:33.71
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.suppliers (id, tenant_id, code, business_name, contact_person, phone, mobile, email, address_1, address_2, city, state, pincode, gstin, drug_license_no, opening_balance, payable_balance, is_active, created_at, updated_at) FROM stdin;
gst_e2e_supplier_95f394ea1bac4ccdb78d5e9420e43f5d	gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	\N	GST Supplier	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	125.00	t	2026-10-31 13:29:28.512	2026-10-31 13:29:28.512
gst_e2e_supplier_3ac4112e2faa4f56adc01cd6c482b6b1	gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	\N	GST Supplier	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	125.00	t	2026-10-31 13:29:43.689	2026-10-31 13:29:43.689
gst_e2e_supplier_088d1fccef84435daa6267d89a4dbaf4	gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	\N	GST Supplier	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	125.00	t	2026-10-31 13:29:58.518	2026-10-31 13:29:58.518
gst_e2e_supplier_29238b0c2adb4a5aa1fd78d4f9000fbe	gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	\N	GST Supplier	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	125.00	t	2026-10-31 13:30:12.558	2026-10-31 13:30:12.558
gst_e2e_supplier_0644c32f8c84448fb99031a27687cd67	gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	\N	GST Supplier	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	125.00	t	2026-10-31 13:31:24.678	2026-10-31 13:31:24.678
gst_e2e_supplier_6f18bb9c8af34b50a8d8e375e7946c79	gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	\N	GST Supplier	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	125.00	t	2026-10-31 13:32:42.82	2026-10-31 13:32:42.82
gst_e2e_supplier_509a773065f1481795c14132bcdf8946	gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	\N	GST Supplier	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	243.00	t	2026-10-31 13:33:55.958	2026-10-31 13:33:57.674
gst_e2e_supplier_f57df7e735f3462bac1432e6082cf6d5	gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	\N	GST Supplier	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	243.00	t	2026-10-31 13:35:09.31	2026-10-31 13:35:11.012
gst_e2e_supplier_b480da5f573d495fb4e753482b2abe9e	gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	\N	GST Supplier	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	243.00	t	2026-10-31 13:36:28.408	2026-10-31 13:36:30.388
gst_e2e_supplier_c63b60377e9d4a8fa15e5396112df0f2	gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	\N	GST Supplier	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	243.00	t	2026-10-31 13:37:50.384	2026-10-31 13:37:51.756
gst_e2e_supplier_f40058d4fa5446239501e43c0d3334ec	gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	\N	GST Supplier	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	243.00	t	2026-10-31 13:39:14.029	2026-10-31 13:39:15.496
gst_e2e_supplier_8b18212293a643b286fb03dcaf60f778	gst_e2e_tenant_19035406820a497699286f211ca126f6	\N	GST Supplier	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	243.00	t	2026-10-31 13:40:27.581	2026-10-31 13:40:29.022
gst_e2e_supplier_94e79b4473e043ff816317b0b593d282	gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	\N	GST Supplier	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	203.00	t	2026-10-31 13:41:41.091	2026-10-31 13:41:43.128
gst_e2e_supplier_056f63b10ffa45f5a326b206d1a237e2	gst_e2e_tenant_adfb498cff894b408a51f898333c9626	\N	GST Supplier	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	203.00	t	2026-10-31 13:42:54.027	2026-10-31 13:42:56.08
gst_e2e_supplier_61ddcc9df9ab450bbe6a88eef8d031d0	gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	\N	GST Supplier	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	203.00	t	2026-10-31 13:44:31.539	2026-10-31 13:44:33.715
\.


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tenants (id, slug, business_name, created_at, updated_at) FROM stdin;
q10-q14-1793420207911-a-tenant	q10-q14-1793420207911-a	Synthetic a	2026-10-31 04:16:47.969	2026-10-31 04:16:47.969
q10-q14-1793420207911-b-tenant	q10-q14-1793420207911-b	Synthetic b	2026-10-31 04:16:48.008	2026-10-31 04:16:48.008
q10-q14-1793420214519-a-tenant	q10-q14-1793420214519-a	Synthetic a	2026-10-31 04:16:54.574	2026-10-31 04:16:54.574
q10-q14-1793420214519-b-tenant	q10-q14-1793420214519-b	Synthetic b	2026-10-31 04:16:54.615	2026-10-31 04:16:54.615
q10-q14-1793420220210-a-tenant	q10-q14-1793420220210-a	Synthetic a	2026-10-31 04:17:00.268	2026-10-31 04:17:00.268
q10-q14-1793420220210-b-tenant	q10-q14-1793420220210-b	Synthetic b	2026-10-31 04:17:00.306	2026-10-31 04:17:00.306
q10-q14-1793420220210-rollback-tenant	q10-q14-1793420220210-rollback	Synthetic rollback	2026-10-31 04:17:00.393	2026-10-31 04:17:00.393
q10-q14-1793420220210-concurrent-tenant	q10-q14-1793420220210-concurrent	Synthetic concurrent	2026-10-31 04:17:00.434	2026-10-31 04:17:00.434
q10-q14-1793420348045-a-tenant	q10-q14-1793420348045-a	Synthetic a	2026-10-31 04:19:08.093	2026-10-31 04:19:08.093
q10-q14-1793420348045-b-tenant	q10-q14-1793420348045-b	Synthetic b	2026-10-31 04:19:08.125	2026-10-31 04:19:08.125
q10-q14-1793420355327-a-tenant	q10-q14-1793420355327-a	Synthetic a	2026-10-31 04:19:15.377	2026-10-31 04:19:15.377
q10-q14-1793420355327-b-tenant	q10-q14-1793420355327-b	Synthetic b	2026-10-31 04:19:15.409	2026-10-31 04:19:15.409
q10-q14-1793420355327-uncertain-tenant	q10-q14-1793420355327-uncertain	Synthetic uncertain	2026-10-31 04:19:15.469	2026-10-31 04:19:15.469
q10-q14-1793420355327-rollback-tenant	q10-q14-1793420355327-rollback	Synthetic rollback	2026-10-31 04:19:15.508	2026-10-31 04:19:15.508
q10-q14-1793420355327-concurrent-tenant	q10-q14-1793420355327-concurrent	Synthetic concurrent	2026-10-31 04:19:15.538	2026-10-31 04:19:15.538
q10-q14-1793420355327-conflicting-tenant	q10-q14-1793420355327-conflicting	Synthetic conflicting	2026-10-31 04:19:15.573	2026-10-31 04:19:15.573
q10-q14-1793421051032-a-tenant	q10-q14-1793421051032-a	Synthetic a	2026-10-31 04:30:51.126	2026-10-31 04:30:51.126
q10-q14-1793421051032-b-tenant	q10-q14-1793421051032-b	Synthetic b	2026-10-31 04:30:51.203	2026-10-31 04:30:51.203
q10-q14-1793421051032-uncertain-tenant	q10-q14-1793421051032-uncertain	Synthetic uncertain	2026-10-31 04:30:51.365	2026-10-31 04:30:51.365
q10-q14-1793421051032-rollback-tenant	q10-q14-1793421051032-rollback	Synthetic rollback	2026-10-31 04:30:51.468	2026-10-31 04:30:51.468
q10-q14-1793421051032-concurrent-tenant	q10-q14-1793421051032-concurrent	Synthetic concurrent	2026-10-31 04:30:51.534	2026-10-31 04:30:51.534
q10-q14-1793421051032-conflicting-tenant	q10-q14-1793421051032-conflicting	Synthetic conflicting	2026-10-31 04:30:51.605	2026-10-31 04:30:51.605
q10-q14-1793421102644-a-tenant	q10-q14-1793421102644-a	Synthetic a	2026-10-31 04:31:42.721	2026-10-31 04:31:42.721
q10-q14-1793421102644-b-tenant	q10-q14-1793421102644-b	Synthetic b	2026-10-31 04:31:42.753	2026-10-31 04:31:42.753
q10-q14-1793421102644-uncertain-tenant	q10-q14-1793421102644-uncertain	Synthetic uncertain	2026-10-31 04:31:42.822	2026-10-31 04:31:42.822
q10-q14-1793421102644-rollback-tenant	q10-q14-1793421102644-rollback	Synthetic rollback	2026-10-31 04:31:42.862	2026-10-31 04:31:42.862
q10-q14-1793421102644-concurrent-tenant	q10-q14-1793421102644-concurrent	Synthetic concurrent	2026-10-31 04:31:42.892	2026-10-31 04:31:42.892
q10-q14-1793421102644-conflicting-tenant	q10-q14-1793421102644-conflicting	Synthetic conflicting	2026-10-31 04:31:42.928	2026-10-31 04:31:42.928
q10-q14-1793421202430-a-tenant	q10-q14-1793421202430-a	Synthetic a	2026-10-31 04:33:22.534	2026-10-31 04:33:22.534
q10-q14-1793421202430-b-tenant	q10-q14-1793421202430-b	Synthetic b	2026-10-31 04:33:22.583	2026-10-31 04:33:22.583
q10-q14-1793421202430-uncertain-tenant	q10-q14-1793421202430-uncertain	Synthetic uncertain	2026-10-31 04:33:22.696	2026-10-31 04:33:22.696
q10-q14-1793421202430-rollback-tenant	q10-q14-1793421202430-rollback	Synthetic rollback	2026-10-31 04:33:22.771	2026-10-31 04:33:22.771
q10-q14-1793421202430-concurrent-tenant	q10-q14-1793421202430-concurrent	Synthetic concurrent	2026-10-31 04:33:22.819	2026-10-31 04:33:22.819
q10-q14-1793421202430-conflicting-tenant	q10-q14-1793421202430-conflicting	Synthetic conflicting	2026-10-31 04:33:22.877	2026-10-31 04:33:22.877
q10-q14-1793421457888-a-tenant	q10-q14-1793421457888-a	Synthetic a	2026-10-31 04:37:37.984	2026-10-31 04:37:37.984
q10-q14-1793421457888-b-tenant	q10-q14-1793421457888-b	Synthetic b	2026-10-31 04:37:38.019	2026-10-31 04:37:38.019
q10-q14-1793421457888-uncertain-tenant	q10-q14-1793421457888-uncertain	Synthetic uncertain	2026-10-31 04:37:38.092	2026-10-31 04:37:38.092
q10-q14-1793421457888-rollback-tenant	q10-q14-1793421457888-rollback	Synthetic rollback	2026-10-31 04:37:38.14	2026-10-31 04:37:38.14
q10-q14-1793421457888-concurrent-tenant	q10-q14-1793421457888-concurrent	Synthetic concurrent	2026-10-31 04:37:38.176	2026-10-31 04:37:38.176
q10-q14-1793421457888-conflicting-tenant	q10-q14-1793421457888-conflicting	Synthetic conflicting	2026-10-31 04:37:38.215	2026-10-31 04:37:38.215
q10-q14-1793421934870-a-tenant	q10-q14-1793421934870-a	Synthetic a	2026-10-31 04:45:34.921	2026-10-31 04:45:34.921
q10-q14-1793421934870-b-tenant	q10-q14-1793421934870-b	Synthetic b	2026-10-31 04:45:34.942	2026-10-31 04:45:34.942
q10-q14-1793421934870-uncertain-tenant	q10-q14-1793421934870-uncertain	Synthetic uncertain	2026-10-31 04:45:34.984	2026-10-31 04:45:34.984
q10-q14-1793421934870-rollback-tenant	q10-q14-1793421934870-rollback	Synthetic rollback	2026-10-31 04:45:35.008	2026-10-31 04:45:35.008
q10-q14-1793421934870-concurrent-tenant	q10-q14-1793421934870-concurrent	Synthetic concurrent	2026-10-31 04:45:35.026	2026-10-31 04:45:35.026
q10-q14-1793421934870-conflicting-tenant	q10-q14-1793421934870-conflicting	Synthetic conflicting	2026-10-31 04:45:35.047	2026-10-31 04:45:35.047
q14-1793428127358-tenant-a	q14-1793428127358-tenant-a	Q14 Tenant A	2026-10-31 06:28:47.394	2026-10-31 06:28:47.394
q14-1793428127358-tenant-b	q14-1793428127358-tenant-b	Q14 Tenant B	2026-10-31 06:28:47.394	2026-10-31 06:28:47.394
q14-1793428135758-tenant-a	q14-1793428135758-tenant-a	Q14 Tenant A	2026-10-31 06:28:55.8	2026-10-31 06:28:55.8
q14-1793428135758-tenant-b	q14-1793428135758-tenant-b	Q14 Tenant B	2026-10-31 06:28:55.8	2026-10-31 06:28:55.8
q14-1793428141699-tenant-a	q14-1793428141699-tenant-a	Q14 Tenant A	2026-10-31 06:29:01.741	2026-10-31 06:29:01.741
q14-1793428141699-tenant-b	q14-1793428141699-tenant-b	Q14 Tenant B	2026-10-31 06:29:01.741	2026-10-31 06:29:01.741
q14-1793428156995-tenant-a	q14-1793428156995-tenant-a	Q14 Tenant A	2026-10-31 06:29:17.04	2026-10-31 06:29:17.04
q14-1793428156995-tenant-b	q14-1793428156995-tenant-b	Q14 Tenant B	2026-10-31 06:29:17.04	2026-10-31 06:29:17.04
q14-1793428163409-tenant-a	q14-1793428163409-tenant-a	Q14 Tenant A	2026-10-31 06:29:23.455	2026-10-31 06:29:23.455
q14-1793428163409-tenant-b	q14-1793428163409-tenant-b	Q14 Tenant B	2026-10-31 06:29:23.455	2026-10-31 06:29:23.455
q14-1793428169511-tenant-a	q14-1793428169511-tenant-a	Q14 Tenant A	2026-10-31 06:29:29.556	2026-10-31 06:29:29.556
q14-1793428169511-tenant-b	q14-1793428169511-tenant-b	Q14 Tenant B	2026-10-31 06:29:29.556	2026-10-31 06:29:29.556
q10-q14-1793428172549-a-tenant	q10-q14-1793428172549-a	Synthetic a	2026-10-31 06:29:32.66	2026-10-31 06:29:32.66
q10-q14-1793428172549-b-tenant	q10-q14-1793428172549-b	Synthetic b	2026-10-31 06:29:32.707	2026-10-31 06:29:32.707
q10-q14-1793428172549-uncertain-tenant	q10-q14-1793428172549-uncertain	Synthetic uncertain	2026-10-31 06:29:32.813	2026-10-31 06:29:32.813
q10-q14-1793428172549-rollback-tenant	q10-q14-1793428172549-rollback	Synthetic rollback	2026-10-31 06:29:32.882	2026-10-31 06:29:32.882
q10-q14-1793428172549-concurrent-tenant	q10-q14-1793428172549-concurrent	Synthetic concurrent	2026-10-31 06:29:32.931	2026-10-31 06:29:32.931
q10-q14-1793428172549-conflicting-tenant	q10-q14-1793428172549-conflicting	Synthetic conflicting	2026-10-31 06:29:32.989	2026-10-31 06:29:32.989
q14-1793428213621-tenant-a	q14-1793428213621-tenant-a	Q14 Tenant A	2026-10-31 06:30:13.661	2026-10-31 06:30:13.661
q14-1793428213621-tenant-b	q14-1793428213621-tenant-b	Q14 Tenant B	2026-10-31 06:30:13.661	2026-10-31 06:30:13.661
q10-q14-1793428213936-a-tenant	q10-q14-1793428213936-a	Synthetic a	2026-10-31 06:30:14.025	2026-10-31 06:30:14.025
q10-q14-1793428213936-b-tenant	q10-q14-1793428213936-b	Synthetic b	2026-10-31 06:30:14.06	2026-10-31 06:30:14.06
q10-q14-1793428213936-uncertain-tenant	q10-q14-1793428213936-uncertain	Synthetic uncertain	2026-10-31 06:30:14.142	2026-10-31 06:30:14.142
q10-q14-1793428213936-rollback-tenant	q10-q14-1793428213936-rollback	Synthetic rollback	2026-10-31 06:30:14.193	2026-10-31 06:30:14.193
q10-q14-1793428213936-concurrent-tenant	q10-q14-1793428213936-concurrent	Synthetic concurrent	2026-10-31 06:30:14.226	2026-10-31 06:30:14.226
q10-q14-1793428213936-conflicting-tenant	q10-q14-1793428213936-conflicting	Synthetic conflicting	2026-10-31 06:30:14.264	2026-10-31 06:30:14.264
q10-app-1793446286377-tenant	q10-app-1793446286377	Q10 Application Synthetic	2026-10-31 11:31:26.379	2026-10-31 11:31:26.379
q10-app-1793446489184-tenant	q10-app-1793446489184	Q10 Application Synthetic	2026-10-31 11:34:49.185	2026-10-31 11:34:49.185
q10-app-1793446623070-tenant	q10-app-1793446623070	Q10 Application Synthetic	2026-10-31 11:37:03.072	2026-10-31 11:37:03.072
q14-1793446696706-tenant-a	q14-1793446696706-tenant-a	Q14 Tenant A	2026-10-31 11:38:16.805	2026-10-31 11:38:16.805
q14-1793446696706-tenant-b	q14-1793446696706-tenant-b	Q14 Tenant B	2026-10-31 11:38:16.805	2026-10-31 11:38:16.805
q10-q14-1793446761696-a-tenant	q10-q14-1793446761696-a	Synthetic a	2026-10-31 11:39:21.775	2026-10-31 11:39:21.775
q10-q14-1793446761696-b-tenant	q10-q14-1793446761696-b	Synthetic b	2026-10-31 11:39:21.805	2026-10-31 11:39:21.805
q10-q14-1793446761696-uncertain-tenant	q10-q14-1793446761696-uncertain	Synthetic uncertain	2026-10-31 11:39:21.875	2026-10-31 11:39:21.875
q10-q14-1793446761696-rollback-tenant	q10-q14-1793446761696-rollback	Synthetic rollback	2026-10-31 11:39:21.92	2026-10-31 11:39:21.92
q10-q14-1793446761696-concurrent-tenant	q10-q14-1793446761696-concurrent	Synthetic concurrent	2026-10-31 11:39:21.948	2026-10-31 11:39:21.948
q10-q14-1793446761696-conflicting-tenant	q10-q14-1793446761696-conflicting	Synthetic conflicting	2026-10-31 11:39:21.986	2026-10-31 11:39:21.986
q10-app-1793447402381-tenant	q10-app-1793447402381	Q10 Application Synthetic	2026-10-31 11:50:02.383	2026-10-31 11:50:02.383
q10-app-1793447603960-tenant	q10-app-1793447603960	Q10 Application Synthetic	2026-10-31 11:53:23.961	2026-10-31 11:53:23.961
q10-q14-1793447682627-a-tenant	q10-q14-1793447682627-a	Synthetic a	2026-10-31 11:54:42.698	2026-10-31 11:54:42.698
q10-q14-1793447682627-b-tenant	q10-q14-1793447682627-b	Synthetic b	2026-10-31 11:54:42.739	2026-10-31 11:54:42.739
q10-q14-1793447682627-uncertain-tenant	q10-q14-1793447682627-uncertain	Synthetic uncertain	2026-10-31 11:54:42.819	2026-10-31 11:54:42.819
q10-q14-1793447682627-rollback-tenant	q10-q14-1793447682627-rollback	Synthetic rollback	2026-10-31 11:54:42.863	2026-10-31 11:54:42.863
q10-q14-1793447682627-concurrent-tenant	q10-q14-1793447682627-concurrent	Synthetic concurrent	2026-10-31 11:54:42.897	2026-10-31 11:54:42.897
q10-q14-1793447682627-conflicting-tenant	q10-q14-1793447682627-conflicting	Synthetic conflicting	2026-10-31 11:54:42.93	2026-10-31 11:54:42.93
q14-1793447733823-tenant-a	q14-1793447733823-tenant-a	Q14 Tenant A	2026-10-31 11:55:33.959	2026-10-31 11:55:33.959
q14-1793447733823-tenant-b	q14-1793447733823-tenant-b	Q14 Tenant B	2026-10-31 11:55:33.959	2026-10-31 11:55:33.959
q10-app-1793452881250-tenant	q10-app-1793452881250	Q10 Application Synthetic	2026-10-31 13:21:21.252	2026-10-31 13:21:21.252
q14-1793452880879-tenant-a	q14-1793452880879-tenant-a	Q14 Tenant A	2026-10-31 13:21:21.293	2026-10-31 13:21:21.293
q14-1793452880879-tenant-b	q14-1793452880879-tenant-b	Q14 Tenant B	2026-10-31 13:21:21.293	2026-10-31 13:21:21.293
q10-app-1793453149906-tenant	q10-app-1793453149906	Q10 Application Synthetic	2026-10-31 13:25:49.908	2026-10-31 13:25:49.908
gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	pharmnos-gst-validation-20261026-gst_e2e_tenant_c348cd84058440a4b664dfd51eee4bf9	GST E2E Business	2026-10-31 13:29:28.512	2026-10-31 13:29:28.512
gst_e2e_tenant_b_f2890db00eda4ee8a30b13d0bd067ba4	pharmnos-gst-validation-20261026-gst_e2e_tenant_b_f2890db00eda4ee8a30b13d0bd067ba4	GST E2E Tenant B	2026-10-31 13:29:28.702	2026-10-31 13:29:28.702
gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	pharmnos-gst-validation-20261026-gst_e2e_tenant_be7ecdbcf8f544f3b0e5b1001d39a102	GST E2E Business	2026-10-31 13:29:43.689	2026-10-31 13:29:43.689
gst_e2e_tenant_b_5707b640c3334b2682d0c2ac2a303e2a	pharmnos-gst-validation-20261026-gst_e2e_tenant_b_5707b640c3334b2682d0c2ac2a303e2a	GST E2E Tenant B	2026-10-31 13:29:43.922	2026-10-31 13:29:43.922
gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	pharmnos-gst-validation-20261026-gst_e2e_tenant_b4cdecc114144f918034f5d604cc1927	GST E2E Business	2026-10-31 13:29:58.518	2026-10-31 13:29:58.518
gst_e2e_tenant_b_916508c122534bc4bae659d2005bd91b	pharmnos-gst-validation-20261026-gst_e2e_tenant_b_916508c122534bc4bae659d2005bd91b	GST E2E Tenant B	2026-10-31 13:29:58.802	2026-10-31 13:29:58.802
gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	pharmnos-gst-validation-20261026-gst_e2e_tenant_47a8576589cb455d89e6f44f2fa1fc19	GST E2E Business	2026-10-31 13:30:12.558	2026-10-31 13:30:12.558
gst_e2e_tenant_b_0798447e44074374924ee0d3b964d89d	pharmnos-gst-validation-20261026-gst_e2e_tenant_b_0798447e44074374924ee0d3b964d89d	GST E2E Tenant B	2026-10-31 13:30:12.815	2026-10-31 13:30:12.815
gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	pharmnos-gst-validation-20261026-gst_e2e_tenant_3e0e9e8fee364851bb12a88b09ab117a	GST E2E Business	2026-10-31 13:31:24.678	2026-10-31 13:31:24.678
gst_e2e_tenant_b_ca5b16ed579546aa8324e9f07edcfc57	pharmnos-gst-validation-20261026-gst_e2e_tenant_b_ca5b16ed579546aa8324e9f07edcfc57	GST E2E Tenant B	2026-10-31 13:31:24.831	2026-10-31 13:31:24.831
gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	pharmnos-gst-validation-20261026-gst_e2e_tenant_b205851ac9b64cf6887a23eed20f6194	GST E2E Business	2026-10-31 13:32:42.82	2026-10-31 13:32:42.82
gst_e2e_tenant_b_adc701fa30c54ad29e4a468ce38a7aef	pharmnos-gst-validation-20261026-gst_e2e_tenant_b_adc701fa30c54ad29e4a468ce38a7aef	GST E2E Tenant B	2026-10-31 13:32:42.981	2026-10-31 13:32:42.981
gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	pharmnos-gst-validation-20261026-gst_e2e_tenant_84b0cd5a499e43f6a447bfc666e826cd	GST E2E Business	2026-10-31 13:33:55.958	2026-10-31 13:33:55.958
gst_e2e_tenant_b_d4a170f4f3494f4792e0c07f7b260d60	pharmnos-gst-validation-20261026-gst_e2e_tenant_b_d4a170f4f3494f4792e0c07f7b260d60	GST E2E Tenant B	2026-10-31 13:33:56.117	2026-10-31 13:33:56.117
gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	pharmnos-gst-validation-20261026-gst_e2e_tenant_cc8b9aa08a7545c5b1033d2bd5373705	GST E2E Business	2026-10-31 13:35:09.31	2026-10-31 13:35:09.31
gst_e2e_tenant_b_9f4f4336629d46c88002ca7dc7352f31	pharmnos-gst-validation-20261026-gst_e2e_tenant_b_9f4f4336629d46c88002ca7dc7352f31	GST E2E Tenant B	2026-10-31 13:35:09.447	2026-10-31 13:35:09.447
gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	pharmnos-gst-validation-20261026-gst_e2e_tenant_e921a7e0cfb84f76a9a001733b713a0f	GST E2E Business	2026-10-31 13:36:28.408	2026-10-31 13:36:28.408
gst_e2e_tenant_b_4124b0ba753543cc86c2946d11105e6e	pharmnos-gst-validation-20261026-gst_e2e_tenant_b_4124b0ba753543cc86c2946d11105e6e	GST E2E Tenant B	2026-10-31 13:36:28.595	2026-10-31 13:36:28.595
gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	pharmnos-gst-validation-20261026-gst_e2e_tenant_550ba45ae51b472084a06eb40208ec95	GST E2E Business	2026-10-31 13:37:50.384	2026-10-31 13:37:50.384
gst_e2e_tenant_b_396dfea6e96c40d29c76c5f2037718d6	pharmnos-gst-validation-20261026-gst_e2e_tenant_b_396dfea6e96c40d29c76c5f2037718d6	GST E2E Tenant B	2026-10-31 13:37:50.535	2026-10-31 13:37:50.535
gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	pharmnos-gst-validation-20261026-gst_e2e_tenant_54eaf882ddaa440bb47b31250c60d7f0	GST E2E Business	2026-10-31 13:39:14.029	2026-10-31 13:39:14.029
gst_e2e_tenant_b_fd4b625cef4948749d944ba95749f9db	pharmnos-gst-validation-20261026-gst_e2e_tenant_b_fd4b625cef4948749d944ba95749f9db	GST E2E Tenant B	2026-10-31 13:39:14.14	2026-10-31 13:39:14.14
gst_e2e_tenant_19035406820a497699286f211ca126f6	pharmnos-gst-validation-20261026-gst_e2e_tenant_19035406820a497699286f211ca126f6	GST E2E Business	2026-10-31 13:40:27.581	2026-10-31 13:40:27.581
gst_e2e_tenant_b_027b648798b640b8a8433f26f4735cd1	pharmnos-gst-validation-20261026-gst_e2e_tenant_b_027b648798b640b8a8433f26f4735cd1	GST E2E Tenant B	2026-10-31 13:40:27.717	2026-10-31 13:40:27.717
gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	pharmnos-gst-validation-20261026-gst_e2e_tenant_abf94c761a244f7a805158fe3556f594	GST E2E Business	2026-10-31 13:41:41.091	2026-10-31 13:41:41.091
gst_e2e_tenant_b_e733be046c824ef797c11716dcf3efd5	pharmnos-gst-validation-20261026-gst_e2e_tenant_b_e733be046c824ef797c11716dcf3efd5	GST E2E Tenant B	2026-10-31 13:41:41.248	2026-10-31 13:41:41.248
gst_e2e_tenant_adfb498cff894b408a51f898333c9626	pharmnos-gst-validation-20261026-gst_e2e_tenant_adfb498cff894b408a51f898333c9626	GST E2E Business	2026-10-31 13:42:54.027	2026-10-31 13:42:54.027
gst_e2e_tenant_b_f21a5aa6c7df4046b5b0f2a816a639e0	pharmnos-gst-validation-20261026-gst_e2e_tenant_b_f21a5aa6c7df4046b5b0f2a816a639e0	GST E2E Tenant B	2026-10-31 13:42:54.173	2026-10-31 13:42:54.173
gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	pharmnos-gst-validation-20261026-gst_e2e_tenant_75b270c9c74b4f4a8b59ac0e63cb79d7	GST E2E Business	2026-10-31 13:44:31.539	2026-10-31 13:44:31.539
gst_e2e_tenant_b_9706089031354ffd8c955386477d6fc5	pharmnos-gst-validation-20261026-gst_e2e_tenant_b_9706089031354ffd8c955386477d6fc5	GST E2E Tenant B	2026-10-31 13:44:31.706	2026-10-31 13:44:31.706
q10-app-1793454341866-tenant	q10-app-1793454341866	Q10 Application Synthetic	2026-10-31 13:45:41.869	2026-10-31 13:45:41.869
q10-app-1793454409161-tenant	q10-app-1793454409161	Q10 Application Synthetic	2026-10-31 13:46:49.162	2026-10-31 13:46:49.162
q10-app-1793454491946-tenant	q10-app-1793454491946	Q10 Application Synthetic	2026-10-31 13:48:11.948	2026-10-31 13:48:11.948
q10-app-1793460716221-tenant	q10-app-1793460716221	Q10 Application Synthetic	2026-10-31 15:31:56.222	2026-10-31 15:31:56.222
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, external_id, email, full_name, phone, avatar_url, created_at, updated_at) FROM stdin;
q10-q14-1793420207911-a-user	q10-q14-1793420207911-a	q10-q14-1793420207911-a@example.invalid	Synthetic a	\N	\N	2026-10-31 04:16:47.969	2026-10-31 04:16:47.969
q10-q14-1793420207911-b-user	q10-q14-1793420207911-b	q10-q14-1793420207911-b@example.invalid	Synthetic b	\N	\N	2026-10-31 04:16:48.008	2026-10-31 04:16:48.008
q10-q14-1793420214519-a-user	q10-q14-1793420214519-a	q10-q14-1793420214519-a@example.invalid	Synthetic a	\N	\N	2026-10-31 04:16:54.574	2026-10-31 04:16:54.574
q10-q14-1793420214519-b-user	q10-q14-1793420214519-b	q10-q14-1793420214519-b@example.invalid	Synthetic b	\N	\N	2026-10-31 04:16:54.615	2026-10-31 04:16:54.615
q10-q14-1793420220210-a-user	q10-q14-1793420220210-a	q10-q14-1793420220210-a@example.invalid	Synthetic a	\N	\N	2026-10-31 04:17:00.268	2026-10-31 04:17:00.268
q10-q14-1793420220210-b-user	q10-q14-1793420220210-b	q10-q14-1793420220210-b@example.invalid	Synthetic b	\N	\N	2026-10-31 04:17:00.306	2026-10-31 04:17:00.306
q10-q14-1793420220210-rollback-user	q10-q14-1793420220210-rollback	q10-q14-1793420220210-rollback@example.invalid	Synthetic rollback	\N	\N	2026-10-31 04:17:00.393	2026-10-31 04:17:00.393
q10-q14-1793420220210-concurrent-user	q10-q14-1793420220210-concurrent	q10-q14-1793420220210-concurrent@example.invalid	Synthetic concurrent	\N	\N	2026-10-31 04:17:00.434	2026-10-31 04:17:00.434
q10-q14-1793420348045-a-user	q10-q14-1793420348045-a	q10-q14-1793420348045-a@example.invalid	Synthetic a	\N	\N	2026-10-31 04:19:08.093	2026-10-31 04:19:08.093
q10-q14-1793420348045-b-user	q10-q14-1793420348045-b	q10-q14-1793420348045-b@example.invalid	Synthetic b	\N	\N	2026-10-31 04:19:08.125	2026-10-31 04:19:08.125
q10-q14-1793420355327-a-user	q10-q14-1793420355327-a	q10-q14-1793420355327-a@example.invalid	Synthetic a	\N	\N	2026-10-31 04:19:15.377	2026-10-31 04:19:15.377
q10-q14-1793420355327-b-user	q10-q14-1793420355327-b	q10-q14-1793420355327-b@example.invalid	Synthetic b	\N	\N	2026-10-31 04:19:15.409	2026-10-31 04:19:15.409
q10-q14-1793420355327-uncertain-user	q10-q14-1793420355327-uncertain	q10-q14-1793420355327-uncertain@example.invalid	Synthetic uncertain	\N	\N	2026-10-31 04:19:15.469	2026-10-31 04:19:15.469
q10-q14-1793420355327-rollback-user	q10-q14-1793420355327-rollback	q10-q14-1793420355327-rollback@example.invalid	Synthetic rollback	\N	\N	2026-10-31 04:19:15.508	2026-10-31 04:19:15.508
q10-q14-1793420355327-concurrent-user	q10-q14-1793420355327-concurrent	q10-q14-1793420355327-concurrent@example.invalid	Synthetic concurrent	\N	\N	2026-10-31 04:19:15.538	2026-10-31 04:19:15.538
q10-q14-1793420355327-conflicting-user	q10-q14-1793420355327-conflicting	q10-q14-1793420355327-conflicting@example.invalid	Synthetic conflicting	\N	\N	2026-10-31 04:19:15.573	2026-10-31 04:19:15.573
q10-q14-1793421051032-a-user	q10-q14-1793421051032-a	q10-q14-1793421051032-a@example.invalid	Synthetic a	\N	\N	2026-10-31 04:30:51.126	2026-10-31 04:30:51.126
q10-q14-1793421051032-b-user	q10-q14-1793421051032-b	q10-q14-1793421051032-b@example.invalid	Synthetic b	\N	\N	2026-10-31 04:30:51.203	2026-10-31 04:30:51.203
q10-q14-1793421051032-uncertain-user	q10-q14-1793421051032-uncertain	q10-q14-1793421051032-uncertain@example.invalid	Synthetic uncertain	\N	\N	2026-10-31 04:30:51.365	2026-10-31 04:30:51.365
q10-q14-1793421051032-rollback-user	q10-q14-1793421051032-rollback	q10-q14-1793421051032-rollback@example.invalid	Synthetic rollback	\N	\N	2026-10-31 04:30:51.468	2026-10-31 04:30:51.468
q10-q14-1793421051032-concurrent-user	q10-q14-1793421051032-concurrent	q10-q14-1793421051032-concurrent@example.invalid	Synthetic concurrent	\N	\N	2026-10-31 04:30:51.534	2026-10-31 04:30:51.534
q10-q14-1793421051032-conflicting-user	q10-q14-1793421051032-conflicting	q10-q14-1793421051032-conflicting@example.invalid	Synthetic conflicting	\N	\N	2026-10-31 04:30:51.605	2026-10-31 04:30:51.605
q10-q14-1793421102644-a-user	q10-q14-1793421102644-a	q10-q14-1793421102644-a@example.invalid	Synthetic a	\N	\N	2026-10-31 04:31:42.721	2026-10-31 04:31:42.721
q10-q14-1793421102644-b-user	q10-q14-1793421102644-b	q10-q14-1793421102644-b@example.invalid	Synthetic b	\N	\N	2026-10-31 04:31:42.753	2026-10-31 04:31:42.753
q10-q14-1793421102644-uncertain-user	q10-q14-1793421102644-uncertain	q10-q14-1793421102644-uncertain@example.invalid	Synthetic uncertain	\N	\N	2026-10-31 04:31:42.822	2026-10-31 04:31:42.822
q10-q14-1793421102644-rollback-user	q10-q14-1793421102644-rollback	q10-q14-1793421102644-rollback@example.invalid	Synthetic rollback	\N	\N	2026-10-31 04:31:42.862	2026-10-31 04:31:42.862
q10-q14-1793421102644-concurrent-user	q10-q14-1793421102644-concurrent	q10-q14-1793421102644-concurrent@example.invalid	Synthetic concurrent	\N	\N	2026-10-31 04:31:42.892	2026-10-31 04:31:42.892
q10-q14-1793421102644-conflicting-user	q10-q14-1793421102644-conflicting	q10-q14-1793421102644-conflicting@example.invalid	Synthetic conflicting	\N	\N	2026-10-31 04:31:42.928	2026-10-31 04:31:42.928
q10-q14-1793421202430-a-user	q10-q14-1793421202430-a	q10-q14-1793421202430-a@example.invalid	Synthetic a	\N	\N	2026-10-31 04:33:22.534	2026-10-31 04:33:22.534
q10-q14-1793421202430-b-user	q10-q14-1793421202430-b	q10-q14-1793421202430-b@example.invalid	Synthetic b	\N	\N	2026-10-31 04:33:22.583	2026-10-31 04:33:22.583
q10-q14-1793421202430-uncertain-user	q10-q14-1793421202430-uncertain	q10-q14-1793421202430-uncertain@example.invalid	Synthetic uncertain	\N	\N	2026-10-31 04:33:22.696	2026-10-31 04:33:22.696
q10-q14-1793421202430-rollback-user	q10-q14-1793421202430-rollback	q10-q14-1793421202430-rollback@example.invalid	Synthetic rollback	\N	\N	2026-10-31 04:33:22.771	2026-10-31 04:33:22.771
q10-q14-1793421202430-concurrent-user	q10-q14-1793421202430-concurrent	q10-q14-1793421202430-concurrent@example.invalid	Synthetic concurrent	\N	\N	2026-10-31 04:33:22.819	2026-10-31 04:33:22.819
q10-q14-1793421202430-conflicting-user	q10-q14-1793421202430-conflicting	q10-q14-1793421202430-conflicting@example.invalid	Synthetic conflicting	\N	\N	2026-10-31 04:33:22.877	2026-10-31 04:33:22.877
q10-q14-1793421457888-a-user	q10-q14-1793421457888-a	q10-q14-1793421457888-a@example.invalid	Synthetic a	\N	\N	2026-10-31 04:37:37.984	2026-10-31 04:37:37.984
q10-q14-1793421457888-b-user	q10-q14-1793421457888-b	q10-q14-1793421457888-b@example.invalid	Synthetic b	\N	\N	2026-10-31 04:37:38.019	2026-10-31 04:37:38.019
q10-q14-1793421457888-uncertain-user	q10-q14-1793421457888-uncertain	q10-q14-1793421457888-uncertain@example.invalid	Synthetic uncertain	\N	\N	2026-10-31 04:37:38.092	2026-10-31 04:37:38.092
q10-q14-1793421457888-rollback-user	q10-q14-1793421457888-rollback	q10-q14-1793421457888-rollback@example.invalid	Synthetic rollback	\N	\N	2026-10-31 04:37:38.14	2026-10-31 04:37:38.14
q10-q14-1793421457888-concurrent-user	q10-q14-1793421457888-concurrent	q10-q14-1793421457888-concurrent@example.invalid	Synthetic concurrent	\N	\N	2026-10-31 04:37:38.176	2026-10-31 04:37:38.176
q10-q14-1793421457888-conflicting-user	q10-q14-1793421457888-conflicting	q10-q14-1793421457888-conflicting@example.invalid	Synthetic conflicting	\N	\N	2026-10-31 04:37:38.215	2026-10-31 04:37:38.215
q10-q14-1793421934870-a-user	q10-q14-1793421934870-a	q10-q14-1793421934870-a@example.invalid	Synthetic a	\N	\N	2026-10-31 04:45:34.921	2026-10-31 04:45:34.921
q10-q14-1793421934870-b-user	q10-q14-1793421934870-b	q10-q14-1793421934870-b@example.invalid	Synthetic b	\N	\N	2026-10-31 04:45:34.942	2026-10-31 04:45:34.942
q10-q14-1793421934870-uncertain-user	q10-q14-1793421934870-uncertain	q10-q14-1793421934870-uncertain@example.invalid	Synthetic uncertain	\N	\N	2026-10-31 04:45:34.984	2026-10-31 04:45:34.984
q10-q14-1793421934870-rollback-user	q10-q14-1793421934870-rollback	q10-q14-1793421934870-rollback@example.invalid	Synthetic rollback	\N	\N	2026-10-31 04:45:35.008	2026-10-31 04:45:35.008
q10-q14-1793421934870-concurrent-user	q10-q14-1793421934870-concurrent	q10-q14-1793421934870-concurrent@example.invalid	Synthetic concurrent	\N	\N	2026-10-31 04:45:35.026	2026-10-31 04:45:35.026
q10-q14-1793421934870-conflicting-user	q10-q14-1793421934870-conflicting	q10-q14-1793421934870-conflicting@example.invalid	Synthetic conflicting	\N	\N	2026-10-31 04:45:35.047	2026-10-31 04:45:35.047
q10-q14-1793446761696-b-user	q10-q14-1793446761696-b	q10-q14-1793446761696-b@example.invalid	Synthetic b	\N	\N	2026-10-31 11:39:21.805	2026-10-31 11:39:21.805
q14-1793428127358-requester	q14-1793428127358-requester-external	q14-1793428127358-requester@example.invalid	Q14 Requester	\N	\N	2026-10-31 06:28:47.4	2026-10-31 06:28:47.4
q14-1793428127358-approver	q14-1793428127358-approver-external	q14-1793428127358-approver@example.invalid	Q14 Approver	\N	\N	2026-10-31 06:28:47.4	2026-10-31 06:28:47.4
q14-1793428127358-executor	q14-1793428127358-executor-external	q14-1793428127358-executor@example.invalid	Q14 Executor	\N	\N	2026-10-31 06:28:47.4	2026-10-31 06:28:47.4
q14-1793428127358-user-b	q14-1793428127358-user-b-external	q14-1793428127358-user-b@example.invalid	Q14 Tenant B User	\N	\N	2026-10-31 06:28:47.4	2026-10-31 06:28:47.4
q14-1793428135758-requester	q14-1793428135758-requester-external	q14-1793428135758-requester@example.invalid	Q14 Requester	\N	\N	2026-10-31 06:28:55.809	2026-10-31 06:28:55.809
q14-1793428135758-approver	q14-1793428135758-approver-external	q14-1793428135758-approver@example.invalid	Q14 Approver	\N	\N	2026-10-31 06:28:55.809	2026-10-31 06:28:55.809
q14-1793428135758-executor	q14-1793428135758-executor-external	q14-1793428135758-executor@example.invalid	Q14 Executor	\N	\N	2026-10-31 06:28:55.809	2026-10-31 06:28:55.809
q14-1793428135758-user-b	q14-1793428135758-user-b-external	q14-1793428135758-user-b@example.invalid	Q14 Tenant B User	\N	\N	2026-10-31 06:28:55.809	2026-10-31 06:28:55.809
q14-1793428141699-requester	q14-1793428141699-requester-external	q14-1793428141699-requester@example.invalid	Q14 Requester	\N	\N	2026-10-31 06:29:01.749	2026-10-31 06:29:01.749
q14-1793428141699-approver	q14-1793428141699-approver-external	q14-1793428141699-approver@example.invalid	Q14 Approver	\N	\N	2026-10-31 06:29:01.749	2026-10-31 06:29:01.749
q14-1793428141699-executor	q14-1793428141699-executor-external	q14-1793428141699-executor@example.invalid	Q14 Executor	\N	\N	2026-10-31 06:29:01.749	2026-10-31 06:29:01.749
q14-1793428141699-user-b	q14-1793428141699-user-b-external	q14-1793428141699-user-b@example.invalid	Q14 Tenant B User	\N	\N	2026-10-31 06:29:01.749	2026-10-31 06:29:01.749
q14-1793428156995-requester	q14-1793428156995-requester-external	q14-1793428156995-requester@example.invalid	Q14 Requester	\N	\N	2026-10-31 06:29:17.049	2026-10-31 06:29:17.049
q14-1793428156995-approver	q14-1793428156995-approver-external	q14-1793428156995-approver@example.invalid	Q14 Approver	\N	\N	2026-10-31 06:29:17.049	2026-10-31 06:29:17.049
q14-1793428156995-executor	q14-1793428156995-executor-external	q14-1793428156995-executor@example.invalid	Q14 Executor	\N	\N	2026-10-31 06:29:17.049	2026-10-31 06:29:17.049
q14-1793428156995-user-b	q14-1793428156995-user-b-external	q14-1793428156995-user-b@example.invalid	Q14 Tenant B User	\N	\N	2026-10-31 06:29:17.049	2026-10-31 06:29:17.049
q14-1793428163409-requester	q14-1793428163409-requester-external	q14-1793428163409-requester@example.invalid	Q14 Requester	\N	\N	2026-10-31 06:29:23.464	2026-10-31 06:29:23.464
q14-1793428163409-approver	q14-1793428163409-approver-external	q14-1793428163409-approver@example.invalid	Q14 Approver	\N	\N	2026-10-31 06:29:23.464	2026-10-31 06:29:23.464
q14-1793428163409-executor	q14-1793428163409-executor-external	q14-1793428163409-executor@example.invalid	Q14 Executor	\N	\N	2026-10-31 06:29:23.464	2026-10-31 06:29:23.464
q14-1793428163409-user-b	q14-1793428163409-user-b-external	q14-1793428163409-user-b@example.invalid	Q14 Tenant B User	\N	\N	2026-10-31 06:29:23.464	2026-10-31 06:29:23.464
q14-1793428169511-requester	q14-1793428169511-requester-external	q14-1793428169511-requester@example.invalid	Q14 Requester	\N	\N	2026-10-31 06:29:29.564	2026-10-31 06:29:29.564
q14-1793428169511-approver	q14-1793428169511-approver-external	q14-1793428169511-approver@example.invalid	Q14 Approver	\N	\N	2026-10-31 06:29:29.564	2026-10-31 06:29:29.564
q14-1793428169511-executor	q14-1793428169511-executor-external	q14-1793428169511-executor@example.invalid	Q14 Executor	\N	\N	2026-10-31 06:29:29.564	2026-10-31 06:29:29.564
q14-1793428169511-user-b	q14-1793428169511-user-b-external	q14-1793428169511-user-b@example.invalid	Q14 Tenant B User	\N	\N	2026-10-31 06:29:29.564	2026-10-31 06:29:29.564
q10-q14-1793428172549-a-user	q10-q14-1793428172549-a	q10-q14-1793428172549-a@example.invalid	Synthetic a	\N	\N	2026-10-31 06:29:32.66	2026-10-31 06:29:32.66
q10-q14-1793428172549-b-user	q10-q14-1793428172549-b	q10-q14-1793428172549-b@example.invalid	Synthetic b	\N	\N	2026-10-31 06:29:32.707	2026-10-31 06:29:32.707
q10-q14-1793428172549-uncertain-user	q10-q14-1793428172549-uncertain	q10-q14-1793428172549-uncertain@example.invalid	Synthetic uncertain	\N	\N	2026-10-31 06:29:32.813	2026-10-31 06:29:32.813
q10-q14-1793428172549-rollback-user	q10-q14-1793428172549-rollback	q10-q14-1793428172549-rollback@example.invalid	Synthetic rollback	\N	\N	2026-10-31 06:29:32.882	2026-10-31 06:29:32.882
q10-q14-1793428172549-concurrent-user	q10-q14-1793428172549-concurrent	q10-q14-1793428172549-concurrent@example.invalid	Synthetic concurrent	\N	\N	2026-10-31 06:29:32.931	2026-10-31 06:29:32.931
q10-q14-1793428172549-conflicting-user	q10-q14-1793428172549-conflicting	q10-q14-1793428172549-conflicting@example.invalid	Synthetic conflicting	\N	\N	2026-10-31 06:29:32.989	2026-10-31 06:29:32.989
q14-1793428213621-requester	q14-1793428213621-requester-external	q14-1793428213621-requester@example.invalid	Q14 Requester	\N	\N	2026-10-31 06:30:13.669	2026-10-31 06:30:13.669
q14-1793428213621-approver	q14-1793428213621-approver-external	q14-1793428213621-approver@example.invalid	Q14 Approver	\N	\N	2026-10-31 06:30:13.669	2026-10-31 06:30:13.669
q14-1793428213621-executor	q14-1793428213621-executor-external	q14-1793428213621-executor@example.invalid	Q14 Executor	\N	\N	2026-10-31 06:30:13.669	2026-10-31 06:30:13.669
q14-1793428213621-user-b	q14-1793428213621-user-b-external	q14-1793428213621-user-b@example.invalid	Q14 Tenant B User	\N	\N	2026-10-31 06:30:13.669	2026-10-31 06:30:13.669
q10-q14-1793428213936-a-user	q10-q14-1793428213936-a	q10-q14-1793428213936-a@example.invalid	Synthetic a	\N	\N	2026-10-31 06:30:14.025	2026-10-31 06:30:14.025
q10-q14-1793428213936-b-user	q10-q14-1793428213936-b	q10-q14-1793428213936-b@example.invalid	Synthetic b	\N	\N	2026-10-31 06:30:14.06	2026-10-31 06:30:14.06
q10-q14-1793428213936-uncertain-user	q10-q14-1793428213936-uncertain	q10-q14-1793428213936-uncertain@example.invalid	Synthetic uncertain	\N	\N	2026-10-31 06:30:14.142	2026-10-31 06:30:14.142
q10-q14-1793428213936-rollback-user	q10-q14-1793428213936-rollback	q10-q14-1793428213936-rollback@example.invalid	Synthetic rollback	\N	\N	2026-10-31 06:30:14.193	2026-10-31 06:30:14.193
q10-q14-1793428213936-concurrent-user	q10-q14-1793428213936-concurrent	q10-q14-1793428213936-concurrent@example.invalid	Synthetic concurrent	\N	\N	2026-10-31 06:30:14.226	2026-10-31 06:30:14.226
q10-q14-1793428213936-conflicting-user	q10-q14-1793428213936-conflicting	q10-q14-1793428213936-conflicting@example.invalid	Synthetic conflicting	\N	\N	2026-10-31 06:30:14.264	2026-10-31 06:30:14.264
q10-app-1793446286377-user	q10-app-1793446286377	q10-app-1793446286377@example.invalid	Q10 Application User	\N	\N	2026-10-31 11:31:26.379	2026-10-31 11:31:26.379
q10-app-1793446489184-user	q10-app-1793446489184	q10-app-1793446489184@example.invalid	Q10 Application User	\N	\N	2026-10-31 11:34:49.185	2026-10-31 11:34:49.185
q10-app-1793446623070-user	q10-app-1793446623070	q10-app-1793446623070@example.invalid	Q10 Application User	\N	\N	2026-10-31 11:37:03.072	2026-10-31 11:37:03.072
q14-1793446696706-requester	q14-1793446696706-requester-external	q14-1793446696706-requester@example.invalid	Q14 Requester	\N	\N	2026-10-31 11:38:16.813	2026-10-31 11:38:16.813
q14-1793446696706-approver	q14-1793446696706-approver-external	q14-1793446696706-approver@example.invalid	Q14 Approver	\N	\N	2026-10-31 11:38:16.813	2026-10-31 11:38:16.813
q14-1793446696706-executor	q14-1793446696706-executor-external	q14-1793446696706-executor@example.invalid	Q14 Executor	\N	\N	2026-10-31 11:38:16.813	2026-10-31 11:38:16.813
q14-1793446696706-user-b	q14-1793446696706-user-b-external	q14-1793446696706-user-b@example.invalid	Q14 Tenant B User	\N	\N	2026-10-31 11:38:16.813	2026-10-31 11:38:16.813
q10-q14-1793446761696-a-user	q10-q14-1793446761696-a	q10-q14-1793446761696-a@example.invalid	Synthetic a	\N	\N	2026-10-31 11:39:21.775	2026-10-31 11:39:21.775
q10-q14-1793446761696-uncertain-user	q10-q14-1793446761696-uncertain	q10-q14-1793446761696-uncertain@example.invalid	Synthetic uncertain	\N	\N	2026-10-31 11:39:21.875	2026-10-31 11:39:21.875
q10-q14-1793446761696-rollback-user	q10-q14-1793446761696-rollback	q10-q14-1793446761696-rollback@example.invalid	Synthetic rollback	\N	\N	2026-10-31 11:39:21.92	2026-10-31 11:39:21.92
q10-q14-1793446761696-concurrent-user	q10-q14-1793446761696-concurrent	q10-q14-1793446761696-concurrent@example.invalid	Synthetic concurrent	\N	\N	2026-10-31 11:39:21.948	2026-10-31 11:39:21.948
q10-q14-1793446761696-conflicting-user	q10-q14-1793446761696-conflicting	q10-q14-1793446761696-conflicting@example.invalid	Synthetic conflicting	\N	\N	2026-10-31 11:39:21.986	2026-10-31 11:39:21.986
q10-app-1793447402381-user	q10-app-1793447402381	q10-app-1793447402381@example.invalid	Q10 Application User	\N	\N	2026-10-31 11:50:02.383	2026-10-31 11:50:02.383
q10-app-1793447603960-user	q10-app-1793447603960	q10-app-1793447603960@example.invalid	Q10 Application User	\N	\N	2026-10-31 11:53:23.961	2026-10-31 11:53:23.961
q10-q14-1793447682627-a-user	q10-q14-1793447682627-a	q10-q14-1793447682627-a@example.invalid	Synthetic a	\N	\N	2026-10-31 11:54:42.698	2026-10-31 11:54:42.698
q10-q14-1793447682627-b-user	q10-q14-1793447682627-b	q10-q14-1793447682627-b@example.invalid	Synthetic b	\N	\N	2026-10-31 11:54:42.739	2026-10-31 11:54:42.739
q10-q14-1793447682627-uncertain-user	q10-q14-1793447682627-uncertain	q10-q14-1793447682627-uncertain@example.invalid	Synthetic uncertain	\N	\N	2026-10-31 11:54:42.819	2026-10-31 11:54:42.819
q10-q14-1793447682627-rollback-user	q10-q14-1793447682627-rollback	q10-q14-1793447682627-rollback@example.invalid	Synthetic rollback	\N	\N	2026-10-31 11:54:42.863	2026-10-31 11:54:42.863
q10-q14-1793447682627-concurrent-user	q10-q14-1793447682627-concurrent	q10-q14-1793447682627-concurrent@example.invalid	Synthetic concurrent	\N	\N	2026-10-31 11:54:42.897	2026-10-31 11:54:42.897
q10-q14-1793447682627-conflicting-user	q10-q14-1793447682627-conflicting	q10-q14-1793447682627-conflicting@example.invalid	Synthetic conflicting	\N	\N	2026-10-31 11:54:42.93	2026-10-31 11:54:42.93
q14-1793447733823-requester	q14-1793447733823-requester-external	q14-1793447733823-requester@example.invalid	Q14 Requester	\N	\N	2026-10-31 11:55:33.968	2026-10-31 11:55:33.968
q14-1793447733823-approver	q14-1793447733823-approver-external	q14-1793447733823-approver@example.invalid	Q14 Approver	\N	\N	2026-10-31 11:55:33.968	2026-10-31 11:55:33.968
q14-1793447733823-executor	q14-1793447733823-executor-external	q14-1793447733823-executor@example.invalid	Q14 Executor	\N	\N	2026-10-31 11:55:33.968	2026-10-31 11:55:33.968
q14-1793447733823-user-b	q14-1793447733823-user-b-external	q14-1793447733823-user-b@example.invalid	Q14 Tenant B User	\N	\N	2026-10-31 11:55:33.968	2026-10-31 11:55:33.968
q10-app-1793452881250-user	q10-app-1793452881250	q10-app-1793452881250@example.invalid	Q10 Application User	\N	\N	2026-10-31 13:21:21.252	2026-10-31 13:21:21.252
q14-1793452880879-requester	q14-1793452880879-requester-external	q14-1793452880879-requester@example.invalid	Q14 Requester	\N	\N	2026-10-31 13:21:21.308	2026-10-31 13:21:21.308
q14-1793452880879-approver	q14-1793452880879-approver-external	q14-1793452880879-approver@example.invalid	Q14 Approver	\N	\N	2026-10-31 13:21:21.308	2026-10-31 13:21:21.308
q14-1793452880879-executor	q14-1793452880879-executor-external	q14-1793452880879-executor@example.invalid	Q14 Executor	\N	\N	2026-10-31 13:21:21.308	2026-10-31 13:21:21.308
q14-1793452880879-user-b	q14-1793452880879-user-b-external	q14-1793452880879-user-b@example.invalid	Q14 Tenant B User	\N	\N	2026-10-31 13:21:21.308	2026-10-31 13:21:21.308
q10-app-1793453149906-user	q10-app-1793453149906	q10-app-1793453149906@example.invalid	Q10 Application User	\N	\N	2026-10-31 13:25:49.908	2026-10-31 13:25:49.908
gst_e2e_user_3150505d81e0469bbfb628cffe5c9bf9	gst_e2e_user_3150505d81e0469bbfb628cffe5c9bf9@financial-e2e.invalid	gst_e2e_user_3150505d81e0469bbfb628cffe5c9bf9@financial-e2e.invalid	GST E2E User	\N	\N	2026-10-31 13:29:28.512	2026-10-31 13:29:28.512
gst_e2e_user_201a2af19f5249ceb962445e5af84b88	gst_e2e_user_201a2af19f5249ceb962445e5af84b88@financial-e2e.invalid	gst_e2e_user_201a2af19f5249ceb962445e5af84b88@financial-e2e.invalid	GST E2E User	\N	\N	2026-10-31 13:29:43.689	2026-10-31 13:29:43.689
gst_e2e_user_32a2363357184cc998bf64097e49da97	gst_e2e_user_32a2363357184cc998bf64097e49da97@financial-e2e.invalid	gst_e2e_user_32a2363357184cc998bf64097e49da97@financial-e2e.invalid	GST E2E User	\N	\N	2026-10-31 13:29:58.518	2026-10-31 13:29:58.518
gst_e2e_user_742f142a1b0a497e9cec9800129dbac2	gst_e2e_user_742f142a1b0a497e9cec9800129dbac2@financial-e2e.invalid	gst_e2e_user_742f142a1b0a497e9cec9800129dbac2@financial-e2e.invalid	GST E2E User	\N	\N	2026-10-31 13:30:12.558	2026-10-31 13:30:12.558
gst_e2e_user_6cba5ebe1d0948bc92358a43ccbde31d	gst_e2e_user_6cba5ebe1d0948bc92358a43ccbde31d@financial-e2e.invalid	gst_e2e_user_6cba5ebe1d0948bc92358a43ccbde31d@financial-e2e.invalid	GST E2E User	\N	\N	2026-10-31 13:31:24.678	2026-10-31 13:31:24.678
gst_e2e_user_1e3d6dc3e3af44828ea74a666498c4b3	gst_e2e_user_1e3d6dc3e3af44828ea74a666498c4b3@financial-e2e.invalid	gst_e2e_user_1e3d6dc3e3af44828ea74a666498c4b3@financial-e2e.invalid	GST E2E User	\N	\N	2026-10-31 13:32:42.82	2026-10-31 13:32:42.82
gst_e2e_user_c9bcf582e8ec42a29706c6758a4c5227	gst_e2e_user_c9bcf582e8ec42a29706c6758a4c5227@financial-e2e.invalid	gst_e2e_user_c9bcf582e8ec42a29706c6758a4c5227@financial-e2e.invalid	GST E2E User	\N	\N	2026-10-31 13:33:55.958	2026-10-31 13:33:55.958
gst_e2e_user_6c87a7d4a4cf4788828673be1bf2844b	gst_e2e_user_6c87a7d4a4cf4788828673be1bf2844b@financial-e2e.invalid	gst_e2e_user_6c87a7d4a4cf4788828673be1bf2844b@financial-e2e.invalid	GST E2E User	\N	\N	2026-10-31 13:35:09.31	2026-10-31 13:35:09.31
gst_e2e_user_f0e91ddf6de143cca30b52d49086168a	gst_e2e_user_f0e91ddf6de143cca30b52d49086168a@financial-e2e.invalid	gst_e2e_user_f0e91ddf6de143cca30b52d49086168a@financial-e2e.invalid	GST E2E User	\N	\N	2026-10-31 13:36:28.408	2026-10-31 13:36:28.408
gst_e2e_user_eed392649bbe46f59b199bee1f03c7e6	gst_e2e_user_eed392649bbe46f59b199bee1f03c7e6@financial-e2e.invalid	gst_e2e_user_eed392649bbe46f59b199bee1f03c7e6@financial-e2e.invalid	GST E2E User	\N	\N	2026-10-31 13:37:50.384	2026-10-31 13:37:50.384
gst_e2e_user_543643bc2f9f43bd8fe5cbdaff72cbef	gst_e2e_user_543643bc2f9f43bd8fe5cbdaff72cbef@financial-e2e.invalid	gst_e2e_user_543643bc2f9f43bd8fe5cbdaff72cbef@financial-e2e.invalid	GST E2E User	\N	\N	2026-10-31 13:39:14.029	2026-10-31 13:39:14.029
gst_e2e_user_3df03d91d95a4aa193cd6d6b5b63d29f	gst_e2e_user_3df03d91d95a4aa193cd6d6b5b63d29f@financial-e2e.invalid	gst_e2e_user_3df03d91d95a4aa193cd6d6b5b63d29f@financial-e2e.invalid	GST E2E User	\N	\N	2026-10-31 13:40:27.581	2026-10-31 13:40:27.581
gst_e2e_user_24a2027af5904578b7fcdaab60fcb210	gst_e2e_user_24a2027af5904578b7fcdaab60fcb210@financial-e2e.invalid	gst_e2e_user_24a2027af5904578b7fcdaab60fcb210@financial-e2e.invalid	GST E2E User	\N	\N	2026-10-31 13:41:41.091	2026-10-31 13:41:41.091
gst_e2e_user_62a1702e07e74656821fa5094b20b72d	gst_e2e_user_62a1702e07e74656821fa5094b20b72d@financial-e2e.invalid	gst_e2e_user_62a1702e07e74656821fa5094b20b72d@financial-e2e.invalid	GST E2E User	\N	\N	2026-10-31 13:42:54.027	2026-10-31 13:42:54.027
gst_e2e_user_b50dbb92d78b45a9947a6a5e5df0cad0	gst_e2e_user_b50dbb92d78b45a9947a6a5e5df0cad0@financial-e2e.invalid	gst_e2e_user_b50dbb92d78b45a9947a6a5e5df0cad0@financial-e2e.invalid	GST E2E User	\N	\N	2026-10-31 13:44:31.539	2026-10-31 13:44:31.539
q10-app-1793454341866-user	q10-app-1793454341866	q10-app-1793454341866@example.invalid	Q10 Application User	\N	\N	2026-10-31 13:45:41.869	2026-10-31 13:45:41.869
q10-app-1793454409161-user	q10-app-1793454409161	q10-app-1793454409161@example.invalid	Q10 Application User	\N	\N	2026-10-31 13:46:49.162	2026-10-31 13:46:49.162
q10-app-1793454491946-user	q10-app-1793454491946	q10-app-1793454491946@example.invalid	Q10 Application User	\N	\N	2026-10-31 13:48:11.948	2026-10-31 13:48:11.948
q10-app-1793460716221-user	q10-app-1793460716221	q10-app-1793460716221@example.invalid	Q10 Application User	\N	\N	2026-10-31 15:31:56.222	2026-10-31 15:31:56.222
\.


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: business_profiles business_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_profiles
    ADD CONSTRAINT business_profiles_pkey PRIMARY KEY (id);


--
-- Name: customer_ledgers customer_ledgers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_ledgers
    ADD CONSTRAINT customer_ledgers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: memberships memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: product_batches product_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: purchase_gst_accounting_decisions purchase_gst_accounting_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_accounting_decisions
    ADD CONSTRAINT purchase_gst_accounting_decisions_pkey PRIMARY KEY (id);


--
-- Name: purchase_gst_calculations purchase_gst_calculations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_calculations
    ADD CONSTRAINT purchase_gst_calculations_pkey PRIMARY KEY (id);


--
-- Name: purchase_gst_evidence_revisions purchase_gst_evidence_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_evidence_revisions
    ADD CONSTRAINT purchase_gst_evidence_revisions_pkey PRIMARY KEY (id);


--
-- Name: purchase_gst_line_evidence purchase_gst_line_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_line_evidence
    ADD CONSTRAINT purchase_gst_line_evidence_pkey PRIMARY KEY (id);


--
-- Name: purchase_gst_reconciliation_event_lines purchase_gst_reconciliation_event_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_reconciliation_event_lines
    ADD CONSTRAINT purchase_gst_reconciliation_event_lines_pkey PRIMARY KEY (id);


--
-- Name: purchase_gst_reconciliation_events purchase_gst_reconciliation_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_reconciliation_events
    ADD CONSTRAINT purchase_gst_reconciliation_events_pkey PRIMARY KEY (id);


--
-- Name: purchase_invoice_items purchase_invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice_items
    ADD CONSTRAINT purchase_invoice_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_invoices purchase_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_pkey PRIMARY KEY (id);


--
-- Name: purchase_posting_operations purchase_posting_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_posting_operations
    ADD CONSTRAINT purchase_posting_operations_pkey PRIMARY KEY (id);


--
-- Name: q14_maintenance_audit q14_maintenance_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.q14_maintenance_audit
    ADD CONSTRAINT q14_maintenance_audit_pkey PRIMARY KEY (id);


--
-- Name: q14_maintenance_probe q14_maintenance_probe_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.q14_maintenance_probe
    ADD CONSTRAINT q14_maintenance_probe_pkey PRIMARY KEY (id);


--
-- Name: q14_soft_delete_audit q14_soft_delete_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.q14_soft_delete_audit
    ADD CONSTRAINT q14_soft_delete_audit_pkey PRIMARY KEY (id);


--
-- Name: q14_soft_delete_requests q14_soft_delete_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.q14_soft_delete_requests
    ADD CONSTRAINT q14_soft_delete_requests_pkey PRIMARY KEY (id);


--
-- Name: q14_soft_delete_requests q14_soft_delete_target_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.q14_soft_delete_requests
    ADD CONSTRAINT q14_soft_delete_target_key UNIQUE (tenant_id, target_table, target_id, id);


--
-- Name: q14_trigger_allowlist q14_trigger_allowlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.q14_trigger_allowlist
    ADD CONSTRAINT q14_trigger_allowlist_pkey PRIMARY KEY (trigger_name);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sales_invoice_items sales_invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_pkey PRIMARY KEY (id);


--
-- Name: sales_invoices sales_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_pkey PRIMARY KEY (id);


--
-- Name: sales_posting_operations sales_posting_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_posting_operations
    ADD CONSTRAINT sales_posting_operations_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: supplier_ledgers supplier_ledgers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_ledgers
    ADD CONSTRAINT supplier_ledgers_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_tenant_id_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_tenant_id_actor_id_idx ON public.audit_logs USING btree (tenant_id, actor_id);


--
-- Name: audit_logs_tenant_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_tenant_id_created_at_idx ON public.audit_logs USING btree (tenant_id, created_at);


--
-- Name: audit_logs_tenant_id_event_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_tenant_id_event_type_idx ON public.audit_logs USING btree (tenant_id, event_type);


--
-- Name: audit_logs_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_tenant_id_idx ON public.audit_logs USING btree (tenant_id);


--
-- Name: business_profiles_tenant_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX business_profiles_tenant_id_key ON public.business_profiles USING btree (tenant_id);


--
-- Name: customer_ledgers_tenant_id_customer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_ledgers_tenant_id_customer_id_idx ON public.customer_ledgers USING btree (tenant_id, customer_id);


--
-- Name: customer_ledgers_tenant_id_entry_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_ledgers_tenant_id_entry_date_idx ON public.customer_ledgers USING btree (tenant_id, entry_date);


--
-- Name: customer_ledgers_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_ledgers_tenant_id_idx ON public.customer_ledgers USING btree (tenant_id);


--
-- Name: customers_tenant_id_business_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_tenant_id_business_name_idx ON public.customers USING btree (tenant_id, business_name);


--
-- Name: customers_tenant_id_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_tenant_id_code_key ON public.customers USING btree (tenant_id, code);


--
-- Name: customers_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_tenant_id_idx ON public.customers USING btree (tenant_id);


--
-- Name: memberships_tenant_id_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX memberships_tenant_id_id_key ON public.memberships USING btree (tenant_id, id);


--
-- Name: memberships_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memberships_tenant_id_idx ON public.memberships USING btree (tenant_id);


--
-- Name: memberships_tenant_id_user_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX memberships_tenant_id_user_id_key ON public.memberships USING btree (tenant_id, user_id);


--
-- Name: memberships_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memberships_user_id_idx ON public.memberships USING btree (user_id);


--
-- Name: payments_tenant_id_customer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_tenant_id_customer_id_idx ON public.payments USING btree (tenant_id, customer_id);


--
-- Name: payments_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_tenant_id_idx ON public.payments USING btree (tenant_id);


--
-- Name: payments_tenant_id_invoice_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_tenant_id_invoice_id_idx ON public.payments USING btree (tenant_id, invoice_id);


--
-- Name: payments_tenant_id_payment_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_tenant_id_payment_date_idx ON public.payments USING btree (tenant_id, payment_date);


--
-- Name: product_batches_tenant_id_available_qty_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_batches_tenant_id_available_qty_idx ON public.product_batches USING btree (tenant_id, available_qty);


--
-- Name: product_batches_tenant_id_expiry_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_batches_tenant_id_expiry_date_idx ON public.product_batches USING btree (tenant_id, expiry_date);


--
-- Name: product_batches_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_batches_tenant_id_idx ON public.product_batches USING btree (tenant_id);


--
-- Name: product_batches_tenant_id_product_id_batch_no_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_batches_tenant_id_product_id_batch_no_key ON public.product_batches USING btree (tenant_id, product_id, batch_no);


--
-- Name: products_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_tenant_id_idx ON public.products USING btree (tenant_id);


--
-- Name: products_tenant_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_tenant_id_is_active_idx ON public.products USING btree (tenant_id, is_active);


--
-- Name: products_tenant_id_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_tenant_id_name_idx ON public.products USING btree (tenant_id, name);


--
-- Name: products_tenant_id_sku_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX products_tenant_id_sku_key ON public.products USING btree (tenant_id, sku);


--
-- Name: purchase_gst_accounting_decisions_tenant_id_purchase_invoic_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_gst_accounting_decisions_tenant_id_purchase_invoic_idx ON public.purchase_gst_accounting_decisions USING btree (tenant_id, purchase_invoice_id, evidence_revision_id);


--
-- Name: purchase_gst_calculations_tenant_id_purchase_invoice_id_evi_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_gst_calculations_tenant_id_purchase_invoice_id_evi_idx ON public.purchase_gst_calculations USING btree (tenant_id, purchase_invoice_id, evidence_revision_id);


--
-- Name: purchase_gst_calculations_tenant_id_purchase_invoice_id_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_gst_calculations_tenant_id_purchase_invoice_id_id_key ON public.purchase_gst_calculations USING btree (tenant_id, purchase_invoice_id, id);


--
-- Name: purchase_gst_calculations_tenant_id_rule_version_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_gst_calculations_tenant_id_rule_version_idx ON public.purchase_gst_calculations USING btree (tenant_id, rule_version);


--
-- Name: purchase_gst_decision_identity_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_gst_decision_identity_key ON public.purchase_gst_accounting_decisions USING btree (tenant_id, purchase_invoice_id, id);


--
-- Name: purchase_gst_decision_reference_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_gst_decision_reference_key ON public.purchase_gst_accounting_decisions USING btree (tenant_id, purchase_invoice_id, evidence_revision_id, decision_reference);


--
-- Name: purchase_gst_event_line_identity_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_gst_event_line_identity_key ON public.purchase_gst_reconciliation_event_lines USING btree (tenant_id, purchase_invoice_id, evidence_revision_id, id);


--
-- Name: purchase_gst_event_line_pair_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_gst_event_line_pair_key ON public.purchase_gst_reconciliation_event_lines USING btree (tenant_id, purchase_invoice_id, evidence_revision_id, event_id, line_evidence_id);


--
-- Name: purchase_gst_evidence_captured_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_gst_evidence_captured_at_idx ON public.purchase_gst_evidence_revisions USING btree (tenant_id, purchase_invoice_id, captured_at);


--
-- Name: purchase_gst_evidence_revision_identity_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_gst_evidence_revision_identity_key ON public.purchase_gst_evidence_revisions USING btree (tenant_id, purchase_invoice_id, id);


--
-- Name: purchase_gst_evidence_revision_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_gst_evidence_revision_kind_idx ON public.purchase_gst_evidence_revisions USING btree (tenant_id, purchase_invoice_id, revision_kind);


--
-- Name: purchase_gst_evidence_revision_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_gst_evidence_revision_number_key ON public.purchase_gst_evidence_revisions USING btree (tenant_id, purchase_invoice_id, revision_number);


--
-- Name: purchase_gst_evidence_revisions_tenant_id_source_fingerprin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_gst_evidence_revisions_tenant_id_source_fingerprin_idx ON public.purchase_gst_evidence_revisions USING btree (tenant_id, source_fingerprint);


--
-- Name: purchase_gst_evidence_supersedes_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_gst_evidence_supersedes_idx ON public.purchase_gst_evidence_revisions USING btree (tenant_id, purchase_invoice_id, supersedes_revision_id);


--
-- Name: purchase_gst_line_evidence_tenant_id_evidence_revision_id_p_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_gst_line_evidence_tenant_id_evidence_revision_id_p_key ON public.purchase_gst_line_evidence USING btree (tenant_id, evidence_revision_id, purchase_invoice_item_id);


--
-- Name: purchase_gst_line_evidence_tenant_id_purchase_invoice_id_ev_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_gst_line_evidence_tenant_id_purchase_invoice_id_ev_idx ON public.purchase_gst_line_evidence USING btree (tenant_id, purchase_invoice_id, evidence_revision_id);


--
-- Name: purchase_gst_line_evidence_tenant_id_purchase_invoice_id_ev_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_gst_line_evidence_tenant_id_purchase_invoice_id_ev_key ON public.purchase_gst_line_evidence USING btree (tenant_id, purchase_invoice_id, evidence_revision_id, id);


--
-- Name: purchase_gst_line_evidence_tenant_id_purchase_invoice_id_pu_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_gst_line_evidence_tenant_id_purchase_invoice_id_pu_idx ON public.purchase_gst_line_evidence USING btree (tenant_id, purchase_invoice_id, purchase_invoice_item_id);


--
-- Name: purchase_gst_reconciliation_events_tenant_id_actor_membersh_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_gst_reconciliation_events_tenant_id_actor_membersh_idx ON public.purchase_gst_reconciliation_events USING btree (tenant_id, actor_membership_id);


--
-- Name: purchase_gst_reconciliation_events_tenant_id_event_kind_cre_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_gst_reconciliation_events_tenant_id_event_kind_cre_idx ON public.purchase_gst_reconciliation_events USING btree (tenant_id, event_kind, created_at);


--
-- Name: purchase_gst_reconciliation_events_tenant_id_evidence_revis_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_gst_reconciliation_events_tenant_id_evidence_revis_idx ON public.purchase_gst_reconciliation_events USING btree (tenant_id, evidence_revision_id, created_at);


--
-- Name: purchase_gst_reconciliation_events_tenant_id_operation_idem_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_gst_reconciliation_events_tenant_id_operation_idem_key ON public.purchase_gst_reconciliation_events USING btree (tenant_id, operation, idempotency_key);


--
-- Name: purchase_gst_reconciliation_events_tenant_id_purchase_invoi_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_gst_reconciliation_events_tenant_id_purchase_invoi_idx ON public.purchase_gst_reconciliation_events USING btree (tenant_id, purchase_invoice_id, created_at);


--
-- Name: purchase_gst_reconciliation_events_tenant_id_purchase_invoi_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_gst_reconciliation_events_tenant_id_purchase_invoi_key ON public.purchase_gst_reconciliation_events USING btree (tenant_id, purchase_invoice_id, evidence_revision_id, id);


--
-- Name: purchase_invoice_items_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_invoice_items_product_id_idx ON public.purchase_invoice_items USING btree (product_id);


--
-- Name: purchase_invoice_items_purchase_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_invoice_items_purchase_id_idx ON public.purchase_invoice_items USING btree (purchase_id);


--
-- Name: purchase_invoice_items_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_invoice_items_tenant_id_idx ON public.purchase_invoice_items USING btree (tenant_id);


--
-- Name: purchase_invoice_items_tenant_id_purchase_id_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_invoice_items_tenant_id_purchase_id_id_key ON public.purchase_invoice_items USING btree (tenant_id, purchase_id, id);


--
-- Name: purchase_invoices_tenant_id_id_current_gst_accounting_decis_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_invoices_tenant_id_id_current_gst_accounting_decis_key ON public.purchase_invoices USING btree (tenant_id, id, current_gst_accounting_decision_id);


--
-- Name: purchase_invoices_tenant_id_id_current_gst_calculation_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_invoices_tenant_id_id_current_gst_calculation_id_key ON public.purchase_invoices USING btree (tenant_id, id, current_gst_calculation_id);


--
-- Name: purchase_invoices_tenant_id_id_current_gst_evidence_revisio_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_invoices_tenant_id_id_current_gst_evidence_revisio_key ON public.purchase_invoices USING btree (tenant_id, id, current_gst_evidence_revision_id);


--
-- Name: purchase_invoices_tenant_id_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_invoices_tenant_id_id_key ON public.purchase_invoices USING btree (tenant_id, id);


--
-- Name: purchase_invoices_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_invoices_tenant_id_idx ON public.purchase_invoices USING btree (tenant_id);


--
-- Name: purchase_invoices_tenant_id_invoice_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_invoices_tenant_id_invoice_date_idx ON public.purchase_invoices USING btree (tenant_id, invoice_date);


--
-- Name: purchase_invoices_tenant_id_invoice_no_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_invoices_tenant_id_invoice_no_key ON public.purchase_invoices USING btree (tenant_id, invoice_no);


--
-- Name: purchase_invoices_tenant_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_invoices_tenant_id_status_idx ON public.purchase_invoices USING btree (tenant_id, status);


--
-- Name: purchase_invoices_tenant_id_supplier_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_invoices_tenant_id_supplier_id_idx ON public.purchase_invoices USING btree (tenant_id, supplier_id);


--
-- Name: purchase_posting_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_posting_idempotency_key ON public.purchase_posting_operations USING btree (tenant_id, idempotency_key);


--
-- Name: purchase_posting_operations_tenant_id_purchase_invoice_id_s_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_posting_operations_tenant_id_purchase_invoice_id_s_idx ON public.purchase_posting_operations USING btree (tenant_id, purchase_invoice_id, status);


--
-- Name: purchase_posting_purchase_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_posting_purchase_key ON public.purchase_posting_operations USING btree (tenant_id, purchase_invoice_id);


--
-- Name: q14_soft_delete_active_request_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX q14_soft_delete_active_request_key ON public.q14_soft_delete_requests USING btree (tenant_id, target_table, target_id) WHERE (status = ANY (ARRAY['REQUESTED'::text, 'APPROVED'::text]));


--
-- Name: role_permissions_role_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX role_permissions_role_id_idx ON public.role_permissions USING btree (role_id);


--
-- Name: role_permissions_role_id_permission_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX role_permissions_role_id_permission_key ON public.role_permissions USING btree (role_id, permission);


--
-- Name: roles_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX roles_tenant_id_idx ON public.roles USING btree (tenant_id);


--
-- Name: roles_tenant_id_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX roles_tenant_id_name_key ON public.roles USING btree (tenant_id, name);


--
-- Name: sales_invoice_items_batch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sales_invoice_items_batch_id_idx ON public.sales_invoice_items USING btree (batch_id);


--
-- Name: sales_invoice_items_invoice_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sales_invoice_items_invoice_id_idx ON public.sales_invoice_items USING btree (invoice_id);


--
-- Name: sales_invoice_items_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sales_invoice_items_product_id_idx ON public.sales_invoice_items USING btree (product_id);


--
-- Name: sales_invoice_items_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sales_invoice_items_tenant_id_idx ON public.sales_invoice_items USING btree (tenant_id);


--
-- Name: sales_invoices_tenant_id_customer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sales_invoices_tenant_id_customer_id_idx ON public.sales_invoices USING btree (tenant_id, customer_id);


--
-- Name: sales_invoices_tenant_id_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sales_invoices_tenant_id_id_key ON public.sales_invoices USING btree (tenant_id, id);


--
-- Name: sales_invoices_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sales_invoices_tenant_id_idx ON public.sales_invoices USING btree (tenant_id);


--
-- Name: sales_invoices_tenant_id_invoice_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sales_invoices_tenant_id_invoice_date_idx ON public.sales_invoices USING btree (tenant_id, invoice_date);


--
-- Name: sales_invoices_tenant_id_invoice_no_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sales_invoices_tenant_id_invoice_no_key ON public.sales_invoices USING btree (tenant_id, invoice_no);


--
-- Name: sales_invoices_tenant_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sales_invoices_tenant_id_status_idx ON public.sales_invoices USING btree (tenant_id, status);


--
-- Name: sales_posting_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sales_posting_idempotency_key ON public.sales_posting_operations USING btree (tenant_id, idempotency_key);


--
-- Name: sales_posting_invoice_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sales_posting_invoice_key ON public.sales_posting_operations USING btree (tenant_id, sales_invoice_id);


--
-- Name: sales_posting_operations_tenant_id_sales_invoice_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sales_posting_operations_tenant_id_sales_invoice_id_status_idx ON public.sales_posting_operations USING btree (tenant_id, sales_invoice_id, status);


--
-- Name: stock_movements_tenant_id_batch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_tenant_id_batch_id_idx ON public.stock_movements USING btree (tenant_id, batch_id);


--
-- Name: stock_movements_tenant_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_tenant_id_created_at_idx ON public.stock_movements USING btree (tenant_id, created_at);


--
-- Name: stock_movements_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_tenant_id_idx ON public.stock_movements USING btree (tenant_id);


--
-- Name: stock_movements_tenant_id_movement_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_tenant_id_movement_type_idx ON public.stock_movements USING btree (tenant_id, movement_type);


--
-- Name: stock_movements_tenant_id_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_tenant_id_product_id_idx ON public.stock_movements USING btree (tenant_id, product_id);


--
-- Name: supplier_ledgers_tenant_id_entry_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_ledgers_tenant_id_entry_date_idx ON public.supplier_ledgers USING btree (tenant_id, entry_date);


--
-- Name: supplier_ledgers_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_ledgers_tenant_id_idx ON public.supplier_ledgers USING btree (tenant_id);


--
-- Name: supplier_ledgers_tenant_id_supplier_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_ledgers_tenant_id_supplier_id_idx ON public.supplier_ledgers USING btree (tenant_id, supplier_id);


--
-- Name: suppliers_tenant_id_business_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suppliers_tenant_id_business_name_idx ON public.suppliers USING btree (tenant_id, business_name);


--
-- Name: suppliers_tenant_id_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX suppliers_tenant_id_code_key ON public.suppliers USING btree (tenant_id, code);


--
-- Name: suppliers_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suppliers_tenant_id_idx ON public.suppliers USING btree (tenant_id);


--
-- Name: tenants_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenants_slug_idx ON public.tenants USING btree (slug);


--
-- Name: tenants_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenants_slug_key ON public.tenants USING btree (slug);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_external_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_external_id_key ON public.users USING btree (external_id);


--
-- Name: purchase_posting_operations guard_purchase_posting_transition; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_purchase_posting_transition BEFORE UPDATE ON public.purchase_posting_operations FOR EACH ROW EXECUTE FUNCTION public.guard_purchase_posting_transition();


--
-- Name: sales_posting_operations guard_sales_posting_transition; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_sales_posting_transition BEFORE UPDATE ON public.sales_posting_operations FOR EACH ROW EXECUTE FUNCTION public.guard_sales_posting_transition();


--
-- Name: purchase_invoices prevent_finalized_purchase_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_finalized_purchase_mutation BEFORE UPDATE ON public.purchase_invoices FOR EACH ROW EXECUTE FUNCTION public.prevent_finalized_purchase_mutation();


--
-- Name: sales_invoices prevent_finalized_sales_invoice_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_finalized_sales_invoice_mutation BEFORE DELETE OR UPDATE ON public.sales_invoices FOR EACH ROW EXECUTE FUNCTION public.prevent_finalized_sales_mutation();


--
-- Name: sales_invoice_items prevent_finalized_sales_item_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_finalized_sales_item_mutation BEFORE DELETE OR UPDATE ON public.sales_invoice_items FOR EACH ROW EXECUTE FUNCTION public.prevent_finalized_sales_mutation();


--
-- Name: purchase_gst_accounting_decisions prevent_purchase_gst_accounting_decisions_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_purchase_gst_accounting_decisions_mutation BEFORE DELETE OR UPDATE ON public.purchase_gst_accounting_decisions FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_history_mutation();


--
-- Name: purchase_gst_calculations prevent_purchase_gst_calculations_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_purchase_gst_calculations_mutation BEFORE DELETE OR UPDATE ON public.purchase_gst_calculations FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_history_mutation();


--
-- Name: purchase_gst_evidence_revisions prevent_purchase_gst_evidence_revisions_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_purchase_gst_evidence_revisions_mutation BEFORE DELETE OR UPDATE ON public.purchase_gst_evidence_revisions FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_history_mutation();


--
-- Name: purchase_gst_line_evidence prevent_purchase_gst_line_evidence_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_purchase_gst_line_evidence_mutation BEFORE DELETE OR UPDATE ON public.purchase_gst_line_evidence FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_history_mutation();


--
-- Name: purchase_gst_reconciliation_event_lines prevent_purchase_gst_reconciliation_event_lines_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_purchase_gst_reconciliation_event_lines_mutation BEFORE DELETE OR UPDATE ON public.purchase_gst_reconciliation_event_lines FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_history_mutation();


--
-- Name: purchase_gst_reconciliation_events prevent_purchase_gst_reconciliation_events_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_purchase_gst_reconciliation_events_mutation BEFORE DELETE OR UPDATE ON public.purchase_gst_reconciliation_events FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_history_mutation();


--
-- Name: q14_maintenance_probe q14_eligible_maintenance_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER q14_eligible_maintenance_trigger BEFORE UPDATE ON public.q14_maintenance_probe FOR EACH ROW EXECUTE FUNCTION q14_security.eligible_probe_trigger();


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: business_profiles business_profiles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_profiles
    ADD CONSTRAINT business_profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: customer_ledgers customer_ledgers_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_ledgers
    ADD CONSTRAINT customer_ledgers_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: customer_ledgers customer_ledgers_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_ledgers
    ADD CONSTRAINT customer_ledgers_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.sales_invoices(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: customer_ledgers customer_ledgers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_ledgers
    ADD CONSTRAINT customer_ledgers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: customers customers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: memberships memberships_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: memberships memberships_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: memberships memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payments payments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.sales_invoices(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_batches product_batches_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_batches product_batches_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchase_invoices(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: product_batches product_batches_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: product_batches product_batches_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: products products_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_gst_calculations purchase_gst_calculation_purchase_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_calculations
    ADD CONSTRAINT purchase_gst_calculation_purchase_fkey FOREIGN KEY (tenant_id, purchase_invoice_id) REFERENCES public.purchase_invoices(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_gst_calculations purchase_gst_calculation_revision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_calculations
    ADD CONSTRAINT purchase_gst_calculation_revision_fkey FOREIGN KEY (tenant_id, purchase_invoice_id, evidence_revision_id) REFERENCES public.purchase_gst_evidence_revisions(tenant_id, purchase_invoice_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_gst_accounting_decisions purchase_gst_decision_actor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_accounting_decisions
    ADD CONSTRAINT purchase_gst_decision_actor_fkey FOREIGN KEY (tenant_id, decided_by_membership_id) REFERENCES public.memberships(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_gst_accounting_decisions purchase_gst_decision_calculation_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_accounting_decisions
    ADD CONSTRAINT purchase_gst_decision_calculation_fkey FOREIGN KEY (tenant_id, purchase_invoice_id, calculation_id) REFERENCES public.purchase_gst_calculations(tenant_id, purchase_invoice_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_gst_accounting_decisions purchase_gst_decision_purchase_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_accounting_decisions
    ADD CONSTRAINT purchase_gst_decision_purchase_fkey FOREIGN KEY (tenant_id, purchase_invoice_id) REFERENCES public.purchase_invoices(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_gst_accounting_decisions purchase_gst_decision_revision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_accounting_decisions
    ADD CONSTRAINT purchase_gst_decision_revision_fkey FOREIGN KEY (tenant_id, purchase_invoice_id, evidence_revision_id) REFERENCES public.purchase_gst_evidence_revisions(tenant_id, purchase_invoice_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_gst_reconciliation_events purchase_gst_event_actor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_reconciliation_events
    ADD CONSTRAINT purchase_gst_event_actor_fkey FOREIGN KEY (tenant_id, actor_membership_id) REFERENCES public.memberships(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_gst_reconciliation_event_lines purchase_gst_event_line_event_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_reconciliation_event_lines
    ADD CONSTRAINT purchase_gst_event_line_event_fkey FOREIGN KEY (tenant_id, purchase_invoice_id, evidence_revision_id, event_id) REFERENCES public.purchase_gst_reconciliation_events(tenant_id, purchase_invoice_id, evidence_revision_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_gst_reconciliation_event_lines purchase_gst_event_line_evidence_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_reconciliation_event_lines
    ADD CONSTRAINT purchase_gst_event_line_evidence_fkey FOREIGN KEY (tenant_id, purchase_invoice_id, evidence_revision_id, line_evidence_id) REFERENCES public.purchase_gst_line_evidence(tenant_id, purchase_invoice_id, evidence_revision_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_gst_reconciliation_events purchase_gst_event_purchase_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_reconciliation_events
    ADD CONSTRAINT purchase_gst_event_purchase_fkey FOREIGN KEY (tenant_id, purchase_invoice_id) REFERENCES public.purchase_invoices(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_gst_reconciliation_events purchase_gst_event_revision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_reconciliation_events
    ADD CONSTRAINT purchase_gst_event_revision_fkey FOREIGN KEY (tenant_id, purchase_invoice_id, evidence_revision_id) REFERENCES public.purchase_gst_evidence_revisions(tenant_id, purchase_invoice_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_gst_evidence_revisions purchase_gst_evidence_capture_actor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_evidence_revisions
    ADD CONSTRAINT purchase_gst_evidence_capture_actor_fkey FOREIGN KEY (tenant_id, captured_by_membership_id) REFERENCES public.memberships(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_gst_evidence_revisions purchase_gst_evidence_purchase_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_evidence_revisions
    ADD CONSTRAINT purchase_gst_evidence_purchase_fkey FOREIGN KEY (tenant_id, purchase_invoice_id) REFERENCES public.purchase_invoices(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_gst_evidence_revisions purchase_gst_evidence_supersedes_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_evidence_revisions
    ADD CONSTRAINT purchase_gst_evidence_supersedes_fkey FOREIGN KEY (tenant_id, purchase_invoice_id, supersedes_revision_id) REFERENCES public.purchase_gst_evidence_revisions(tenant_id, purchase_invoice_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_gst_line_evidence purchase_gst_line_evidence_item_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_line_evidence
    ADD CONSTRAINT purchase_gst_line_evidence_item_fkey FOREIGN KEY (tenant_id, purchase_invoice_id, purchase_invoice_item_id) REFERENCES public.purchase_invoice_items(tenant_id, purchase_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_gst_line_evidence purchase_gst_line_evidence_revision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_line_evidence
    ADD CONSTRAINT purchase_gst_line_evidence_revision_fkey FOREIGN KEY (tenant_id, purchase_invoice_id, evidence_revision_id) REFERENCES public.purchase_gst_evidence_revisions(tenant_id, purchase_invoice_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_gst_line_evidence purchase_gst_line_evidence_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_line_evidence
    ADD CONSTRAINT purchase_gst_line_evidence_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_gst_reconciliation_events purchase_gst_reconciliation_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_gst_reconciliation_events
    ADD CONSTRAINT purchase_gst_reconciliation_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_invoice_items purchase_invoice_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice_items
    ADD CONSTRAINT purchase_invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_invoice_items purchase_invoice_items_purchase_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice_items
    ADD CONSTRAINT purchase_invoice_items_purchase_fkey FOREIGN KEY (tenant_id, purchase_id) REFERENCES public.purchase_invoices(tenant_id, id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_invoice_items purchase_invoice_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice_items
    ADD CONSTRAINT purchase_invoice_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_invoices purchase_invoices_current_gst_accounting_decision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_current_gst_accounting_decision_fkey FOREIGN KEY (tenant_id, id, current_gst_accounting_decision_id) REFERENCES public.purchase_gst_accounting_decisions(tenant_id, purchase_invoice_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_invoices purchase_invoices_current_gst_calculation_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_current_gst_calculation_fkey FOREIGN KEY (tenant_id, id, current_gst_calculation_id) REFERENCES public.purchase_gst_calculations(tenant_id, purchase_invoice_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_invoices purchase_invoices_current_gst_evidence_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_current_gst_evidence_fkey FOREIGN KEY (tenant_id, id, current_gst_evidence_revision_id) REFERENCES public.purchase_gst_evidence_revisions(tenant_id, purchase_invoice_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_invoices purchase_invoices_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_invoices purchase_invoices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_posting_operations purchase_posting_operations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_posting_operations
    ADD CONSTRAINT purchase_posting_operations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_posting_operations purchase_posting_operations_tenant_id_purchase_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_posting_operations
    ADD CONSTRAINT purchase_posting_operations_tenant_id_purchase_invoice_id_fkey FOREIGN KEY (tenant_id, purchase_invoice_id) REFERENCES public.purchase_invoices(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sales_invoice_items sales_invoice_items_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.product_batches(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales_invoice_items sales_invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.sales_invoices(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sales_invoice_items sales_invoice_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales_invoice_items sales_invoice_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sales_invoices sales_invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales_invoices sales_invoices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sales_posting_operations sales_posting_operations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_posting_operations
    ADD CONSTRAINT sales_posting_operations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sales_posting_operations sales_posting_operations_tenant_id_sales_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_posting_operations
    ADD CONSTRAINT sales_posting_operations_tenant_id_sales_invoice_id_fkey FOREIGN KEY (tenant_id, sales_invoice_id) REFERENCES public.sales_invoices(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.product_batches(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: supplier_ledgers supplier_ledgers_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_ledgers
    ADD CONSTRAINT supplier_ledgers_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchase_invoices(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: supplier_ledgers supplier_ledgers_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_ledgers
    ADD CONSTRAINT supplier_ledgers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: supplier_ledgers supplier_ledgers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_ledgers
    ADD CONSTRAINT supplier_ledgers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: suppliers suppliers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: business_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_ledgers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_ledgers ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: product_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_gst_accounting_decisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_gst_accounting_decisions ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_gst_calculations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_gst_calculations ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_gst_evidence_revisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_gst_evidence_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_gst_line_evidence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_gst_line_evidence ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_gst_reconciliation_event_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_gst_reconciliation_event_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_gst_reconciliation_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_gst_reconciliation_events ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_invoice_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_posting_operations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_posting_operations ENABLE ROW LEVEL SECURITY;

--
-- Name: q14_maintenance_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.q14_maintenance_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: q14_soft_delete_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.q14_soft_delete_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: q14_soft_delete_audit q14_soft_delete_audit_tenant_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY q14_soft_delete_audit_tenant_read ON public.q14_soft_delete_audit FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: q14_soft_delete_requests q14_soft_delete_request_tenant_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY q14_soft_delete_request_tenant_read ON public.q14_soft_delete_requests FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: q14_soft_delete_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.q14_soft_delete_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_invoice_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_invoice_items ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_posting_operations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_posting_operations ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_ledgers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.supplier_ledgers ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs tenant_insert_audit_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_audit_logs ON public.audit_logs FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: business_profiles tenant_insert_business_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_business_profiles ON public.business_profiles FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: customer_ledgers tenant_insert_customer_ledgers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_customer_ledgers ON public.customer_ledgers FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: customers tenant_insert_customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_customers ON public.customers FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: memberships tenant_insert_memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_memberships ON public.memberships FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: payments tenant_insert_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_payments ON public.payments FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: product_batches tenant_insert_product_batches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_product_batches ON public.product_batches FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: products tenant_insert_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_products ON public.products FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_gst_accounting_decisions tenant_insert_purchase_gst_accounting_decisions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_purchase_gst_accounting_decisions ON public.purchase_gst_accounting_decisions FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_gst_calculations tenant_insert_purchase_gst_calculations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_purchase_gst_calculations ON public.purchase_gst_calculations FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_gst_evidence_revisions tenant_insert_purchase_gst_evidence_revisions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_purchase_gst_evidence_revisions ON public.purchase_gst_evidence_revisions FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_gst_line_evidence tenant_insert_purchase_gst_line_evidence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_purchase_gst_line_evidence ON public.purchase_gst_line_evidence FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_gst_reconciliation_event_lines tenant_insert_purchase_gst_reconciliation_event_lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_purchase_gst_reconciliation_event_lines ON public.purchase_gst_reconciliation_event_lines FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_gst_reconciliation_events tenant_insert_purchase_gst_reconciliation_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_purchase_gst_reconciliation_events ON public.purchase_gst_reconciliation_events FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_invoice_items tenant_insert_purchase_invoice_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_purchase_invoice_items ON public.purchase_invoice_items FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_invoices tenant_insert_purchase_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_purchase_invoices ON public.purchase_invoices FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_posting_operations tenant_insert_purchase_posting_operations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_purchase_posting_operations ON public.purchase_posting_operations FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: role_permissions tenant_insert_role_permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_role_permissions ON public.role_permissions FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((EXISTS ( SELECT 1
   FROM public.roles r
  WHERE ((r.id = role_permissions.role_id) AND (r.tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))))));


--
-- Name: roles tenant_insert_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_roles ON public.roles FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: sales_invoice_items tenant_insert_sales_invoice_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_sales_invoice_items ON public.sales_invoice_items FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: sales_invoices tenant_insert_sales_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_sales_invoices ON public.sales_invoices FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: sales_posting_operations tenant_insert_sales_posting_operations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_sales_posting_operations ON public.sales_posting_operations FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: stock_movements tenant_insert_stock_movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_stock_movements ON public.stock_movements FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: supplier_ledgers tenant_insert_supplier_ledgers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_supplier_ledgers ON public.supplier_ledgers FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: suppliers tenant_insert_suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_suppliers ON public.suppliers FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: tenants tenant_insert_tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_tenants ON public.tenants FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: users tenant_insert_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert_users ON public.users FOR INSERT TO pharmnos_e2e_runtime WITH CHECK ((EXISTS ( SELECT 1
   FROM public.memberships m
  WHERE ((m.user_id = users.id) AND (m.tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))))));


--
-- Name: audit_logs tenant_select_audit_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_audit_logs ON public.audit_logs FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: business_profiles tenant_select_business_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_business_profiles ON public.business_profiles FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: customer_ledgers tenant_select_customer_ledgers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_customer_ledgers ON public.customer_ledgers FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: customers tenant_select_customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_customers ON public.customers FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: memberships tenant_select_memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_memberships ON public.memberships FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: payments tenant_select_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_payments ON public.payments FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: product_batches tenant_select_product_batches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_product_batches ON public.product_batches FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: products tenant_select_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_products ON public.products FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_gst_accounting_decisions tenant_select_purchase_gst_accounting_decisions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_purchase_gst_accounting_decisions ON public.purchase_gst_accounting_decisions FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_gst_calculations tenant_select_purchase_gst_calculations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_purchase_gst_calculations ON public.purchase_gst_calculations FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_gst_evidence_revisions tenant_select_purchase_gst_evidence_revisions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_purchase_gst_evidence_revisions ON public.purchase_gst_evidence_revisions FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_gst_line_evidence tenant_select_purchase_gst_line_evidence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_purchase_gst_line_evidence ON public.purchase_gst_line_evidence FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_gst_reconciliation_event_lines tenant_select_purchase_gst_reconciliation_event_lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_purchase_gst_reconciliation_event_lines ON public.purchase_gst_reconciliation_event_lines FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_gst_reconciliation_events tenant_select_purchase_gst_reconciliation_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_purchase_gst_reconciliation_events ON public.purchase_gst_reconciliation_events FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_invoice_items tenant_select_purchase_invoice_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_purchase_invoice_items ON public.purchase_invoice_items FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_invoices tenant_select_purchase_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_purchase_invoices ON public.purchase_invoices FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_posting_operations tenant_select_purchase_posting_operations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_purchase_posting_operations ON public.purchase_posting_operations FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: role_permissions tenant_select_role_permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_role_permissions ON public.role_permissions FOR SELECT TO pharmnos_e2e_runtime USING ((EXISTS ( SELECT 1
   FROM public.roles r
  WHERE ((r.id = role_permissions.role_id) AND (r.tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))))));


--
-- Name: roles tenant_select_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_roles ON public.roles FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: sales_invoice_items tenant_select_sales_invoice_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_sales_invoice_items ON public.sales_invoice_items FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: sales_invoices tenant_select_sales_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_sales_invoices ON public.sales_invoices FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: sales_posting_operations tenant_select_sales_posting_operations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_sales_posting_operations ON public.sales_posting_operations FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: stock_movements tenant_select_stock_movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_stock_movements ON public.stock_movements FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: supplier_ledgers tenant_select_supplier_ledgers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_supplier_ledgers ON public.supplier_ledgers FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: suppliers tenant_select_suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_suppliers ON public.suppliers FOR SELECT TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: tenants tenant_select_tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_tenants ON public.tenants FOR SELECT TO pharmnos_e2e_runtime USING ((id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: users tenant_select_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select_users ON public.users FOR SELECT TO pharmnos_e2e_runtime USING ((EXISTS ( SELECT 1
   FROM public.memberships m
  WHERE ((m.user_id = users.id) AND (m.tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))))));


--
-- Name: business_profiles tenant_update_business_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_business_profiles ON public.business_profiles FOR UPDATE TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))) WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: customer_ledgers tenant_update_customer_ledgers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_customer_ledgers ON public.customer_ledgers FOR UPDATE TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))) WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: customers tenant_update_customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_customers ON public.customers FOR UPDATE TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))) WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: memberships tenant_update_memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_memberships ON public.memberships FOR UPDATE TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))) WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: payments tenant_update_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_payments ON public.payments FOR UPDATE TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))) WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: product_batches tenant_update_product_batches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_product_batches ON public.product_batches FOR UPDATE TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))) WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: products tenant_update_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_products ON public.products FOR UPDATE TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))) WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_invoice_items tenant_update_purchase_invoice_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_purchase_invoice_items ON public.purchase_invoice_items FOR UPDATE TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))) WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_invoices tenant_update_purchase_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_purchase_invoices ON public.purchase_invoices FOR UPDATE TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))) WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: purchase_posting_operations tenant_update_purchase_posting_operations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_purchase_posting_operations ON public.purchase_posting_operations FOR UPDATE TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))) WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: role_permissions tenant_update_role_permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_role_permissions ON public.role_permissions FOR UPDATE TO pharmnos_e2e_runtime USING ((EXISTS ( SELECT 1
   FROM public.roles r
  WHERE ((r.id = role_permissions.role_id) AND (r.tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.roles r
  WHERE ((r.id = role_permissions.role_id) AND (r.tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))))));


--
-- Name: roles tenant_update_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_roles ON public.roles FOR UPDATE TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))) WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: sales_invoice_items tenant_update_sales_invoice_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_sales_invoice_items ON public.sales_invoice_items FOR UPDATE TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))) WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: sales_invoices tenant_update_sales_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_sales_invoices ON public.sales_invoices FOR UPDATE TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))) WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: sales_posting_operations tenant_update_sales_posting_operations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_sales_posting_operations ON public.sales_posting_operations FOR UPDATE TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))) WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: stock_movements tenant_update_stock_movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_stock_movements ON public.stock_movements FOR UPDATE TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))) WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: supplier_ledgers tenant_update_supplier_ledgers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_supplier_ledgers ON public.supplier_ledgers FOR UPDATE TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))) WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: suppliers tenant_update_suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_suppliers ON public.suppliers FOR UPDATE TO pharmnos_e2e_runtime USING ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))) WITH CHECK ((tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: tenants tenant_update_tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_tenants ON public.tenants FOR UPDATE TO pharmnos_e2e_runtime USING ((id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))) WITH CHECK ((id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)));


--
-- Name: users tenant_update_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update_users ON public.users FOR UPDATE TO pharmnos_e2e_runtime USING ((EXISTS ( SELECT 1
   FROM public.memberships m
  WHERE ((m.user_id = users.id) AND (m.tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.memberships m
  WHERE ((m.user_id = users.id) AND (m.tenant_id = NULLIF(current_setting('request.jwt.claim.tenant_id'::text, true), ''::text))))));


--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO pharmnos_e2e_runtime;


--
-- Name: SCHEMA q14_security; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA q14_security TO pharmnos_e2e_runtime;
GRANT USAGE ON SCHEMA q14_security TO pharmnos_e2e_admin;
GRANT USAGE ON SCHEMA q14_security TO pharmnos_e2e_validation;


--
-- Name: TYPE "AuditEventType"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TYPE public."AuditEventType" TO pharmnos_e2e_runtime;


--
-- Name: TYPE "InvoiceStatus"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TYPE public."InvoiceStatus" TO pharmnos_e2e_runtime;


--
-- Name: TYPE "LedgerEntryType"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TYPE public."LedgerEntryType" TO pharmnos_e2e_runtime;


--
-- Name: TYPE "PaymentMode"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TYPE public."PaymentMode" TO pharmnos_e2e_runtime;


--
-- Name: TYPE "PermissionAction"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TYPE public."PermissionAction" TO pharmnos_e2e_runtime;


--
-- Name: TYPE "PurchaseGstAccountingAcceptanceStatus"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TYPE public."PurchaseGstAccountingAcceptanceStatus" TO pharmnos_e2e_runtime;


--
-- Name: TYPE "PurchaseGstEvidenceRevisionKind"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TYPE public."PurchaseGstEvidenceRevisionKind" TO pharmnos_e2e_runtime;


--
-- Name: TYPE "PurchaseGstReconciliationEventKind"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TYPE public."PurchaseGstReconciliationEventKind" TO pharmnos_e2e_runtime;


--
-- Name: TYPE "PurchaseGstReconciliationStatus"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TYPE public."PurchaseGstReconciliationStatus" TO pharmnos_e2e_runtime;


--
-- Name: TYPE "ScheduleClass"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TYPE public."ScheduleClass" TO pharmnos_e2e_runtime;


--
-- Name: TYPE "StockMovementType"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TYPE public."StockMovementType" TO pharmnos_e2e_runtime;


--
-- Name: TYPE "SystemRole"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TYPE public."SystemRole" TO pharmnos_e2e_runtime;


--
-- Name: TYPE "TaxDataStatus"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TYPE public."TaxDataStatus" TO pharmnos_e2e_runtime;


--
-- Name: FUNCTION guard_sales_posting_transition(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.guard_sales_posting_transition() FROM PUBLIC;


--
-- Name: FUNCTION approve_soft_delete(p_request_id text, p_actor_id text); Type: ACL; Schema: q14_security; Owner: -
--

REVOKE ALL ON FUNCTION q14_security.approve_soft_delete(p_request_id text, p_actor_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION q14_security.approve_soft_delete(p_request_id text, p_actor_id text) TO pharmnos_e2e_admin;


--
-- Name: FUNCTION execute_soft_delete(p_request_id text, p_actor_id text); Type: ACL; Schema: q14_security; Owner: -
--

REVOKE ALL ON FUNCTION q14_security.execute_soft_delete(p_request_id text, p_actor_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION q14_security.execute_soft_delete(p_request_id text, p_actor_id text) TO pharmnos_e2e_validation;


--
-- Name: FUNCTION maintain_allowlisted_trigger(p_trigger_name text, p_table_name text, p_purpose text, p_actor_id text, p_simulate_operation_failure boolean, p_simulate_restore_failure boolean); Type: ACL; Schema: q14_security; Owner: -
--

REVOKE ALL ON FUNCTION q14_security.maintain_allowlisted_trigger(p_trigger_name text, p_table_name text, p_purpose text, p_actor_id text, p_simulate_operation_failure boolean, p_simulate_restore_failure boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION q14_security.maintain_allowlisted_trigger(p_trigger_name text, p_table_name text, p_purpose text, p_actor_id text, p_simulate_operation_failure boolean, p_simulate_restore_failure boolean) TO pharmnos_e2e_admin;


--
-- Name: FUNCTION request_soft_delete(p_tenant_id text, p_target_table text, p_target_id text, p_reason text, p_actor_id text); Type: ACL; Schema: q14_security; Owner: -
--

REVOKE ALL ON FUNCTION q14_security.request_soft_delete(p_tenant_id text, p_target_table text, p_target_id text, p_reason text, p_actor_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION q14_security.request_soft_delete(p_tenant_id text, p_target_table text, p_target_id text, p_reason text, p_actor_id text) TO pharmnos_e2e_runtime;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.audit_logs TO pharmnos_e2e_runtime;


--
-- Name: TABLE business_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.business_profiles TO pharmnos_e2e_runtime;


--
-- Name: TABLE customer_ledgers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.customer_ledgers TO pharmnos_e2e_runtime;


--
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.customers TO pharmnos_e2e_runtime;


--
-- Name: TABLE memberships; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.memberships TO pharmnos_e2e_runtime;


--
-- Name: TABLE payments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.payments TO pharmnos_e2e_runtime;


--
-- Name: TABLE product_batches; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.product_batches TO pharmnos_e2e_runtime;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.products TO pharmnos_e2e_runtime;


--
-- Name: TABLE purchase_gst_accounting_decisions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.purchase_gst_accounting_decisions TO pharmnos_e2e_runtime;


--
-- Name: TABLE purchase_gst_calculations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.purchase_gst_calculations TO pharmnos_e2e_runtime;


--
-- Name: TABLE purchase_gst_evidence_revisions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.purchase_gst_evidence_revisions TO pharmnos_e2e_runtime;


--
-- Name: TABLE purchase_gst_line_evidence; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.purchase_gst_line_evidence TO pharmnos_e2e_runtime;


--
-- Name: TABLE purchase_gst_reconciliation_event_lines; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.purchase_gst_reconciliation_event_lines TO pharmnos_e2e_runtime;


--
-- Name: TABLE purchase_gst_reconciliation_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.purchase_gst_reconciliation_events TO pharmnos_e2e_runtime;


--
-- Name: TABLE purchase_invoice_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.purchase_invoice_items TO pharmnos_e2e_runtime;


--
-- Name: TABLE purchase_invoices; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.purchase_invoices TO pharmnos_e2e_runtime;


--
-- Name: TABLE purchase_posting_operations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.purchase_posting_operations TO pharmnos_e2e_runtime;


--
-- Name: TABLE q14_soft_delete_audit; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.q14_soft_delete_audit TO pharmnos_e2e_runtime;


--
-- Name: TABLE q14_soft_delete_requests; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.q14_soft_delete_requests TO pharmnos_e2e_runtime;


--
-- Name: TABLE role_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.role_permissions TO pharmnos_e2e_runtime;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.roles TO pharmnos_e2e_runtime;


--
-- Name: TABLE sales_invoice_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.sales_invoice_items TO pharmnos_e2e_runtime;


--
-- Name: TABLE sales_invoices; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.sales_invoices TO pharmnos_e2e_runtime;


--
-- Name: TABLE sales_posting_operations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.sales_posting_operations TO pharmnos_e2e_runtime;


--
-- Name: COLUMN sales_posting_operations.status; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(status) ON TABLE public.sales_posting_operations TO pharmnos_e2e_runtime;


--
-- Name: COLUMN sales_posting_operations.result_invoice_no; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(result_invoice_no) ON TABLE public.sales_posting_operations TO pharmnos_e2e_runtime;


--
-- Name: COLUMN sales_posting_operations.result_sales_id; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(result_sales_id) ON TABLE public.sales_posting_operations TO pharmnos_e2e_runtime;


--
-- Name: COLUMN sales_posting_operations.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(updated_at) ON TABLE public.sales_posting_operations TO pharmnos_e2e_runtime;


--
-- Name: TABLE stock_movements; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.stock_movements TO pharmnos_e2e_runtime;


--
-- Name: TABLE supplier_ledgers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.supplier_ledgers TO pharmnos_e2e_runtime;


--
-- Name: TABLE suppliers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.suppliers TO pharmnos_e2e_runtime;


--
-- Name: TABLE tenants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.tenants TO pharmnos_e2e_runtime;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.users TO pharmnos_e2e_runtime;


--
-- PostgreSQL database dump complete
--

\unrestrict qNqiJITarGJz48yfKgS8Ic2JhzLFazg65incMj6bxd8tqEq8nddDMOczVivPKxB

