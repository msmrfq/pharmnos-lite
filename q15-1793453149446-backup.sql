--
-- PostgreSQL database dump
--

\restrict l8kOzUbBZQmraS2O5kKpo5kXTlfq6PsJZGeyZw0UwqlgRBfFLMekVrIxspjI5Dx

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
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
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
q10-app-1793446286377-customer	q10-app-1793446286377-tenant	\N	Q10 Application Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	236.00	t	2026-10-31 11:31:26.379	2026-10-31 11:31:27.272
q10-app-1793446489184-customer	q10-app-1793446489184-tenant	\N	Q10 Application Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	236.00	t	2026-10-31 11:34:49.185	2026-10-31 11:34:50.076
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
q10-app-1793452881250-customer	q10-app-1793452881250-tenant	\N	Q10 Application Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	236.00	t	2026-10-31 13:21:21.252	2026-10-31 13:21:22.618
q10-app-1793453149906-customer	q10-app-1793453149906-tenant	\N	Q10 Application Customer	\N	\N	\N	\N	\N	\N	\N	MH	\N	\N	\N	\N	\N	\N	236.00	t	2026-10-31 13:25:49.908	2026-10-31 13:25:51.641
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
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payments (id, tenant_id, customer_id, invoice_id, entry_type, payment_mode, amount, reference_no, payment_date, notes, created_by, created_at) FROM stdin;
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
\.


--
-- Data for Name: purchase_gst_accounting_decisions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_gst_accounting_decisions (id, tenant_id, purchase_invoice_id, evidence_revision_id, calculation_id, accepted_taxable_value, accepted_cgst, accepted_sgst, accepted_igst, accepted_cess, accepted_invoice_total, accepted_round_off, accepted_value_source, decision_reference, decision_outcome, rationale, decided_at, decided_by_membership_id) FROM stdin;
\.


--
-- Data for Name: purchase_gst_calculations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_gst_calculations (id, tenant_id, purchase_invoice_id, evidence_revision_id, rule_version, calculated_at, calculation_provenance, input_fingerprint, calculated_taxable_value, calculated_cgst, calculated_sgst, calculated_igst, calculated_cess, calculated_invoice_total, calculated_round_off) FROM stdin;
\.


--
-- Data for Name: purchase_gst_evidence_revisions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_gst_evidence_revisions (id, tenant_id, purchase_invoice_id, revision_number, revision_kind, supersedes_revision_id, source_document_reference, capture_channel, capture_provenance, correction_reason, captured_at, captured_by_membership_id, declared_taxable_value_raw, declared_cgst_raw, declared_sgst_raw, declared_igst_raw, declared_cess_raw, declared_invoice_total_raw, declared_round_off_raw, declared_taxable_value, declared_cgst, declared_sgst, declared_igst, declared_cess, declared_invoice_total, declared_round_off, supplier_state_at_transaction, recipient_state_at_transaction, delivery_state_at_transaction, supply_scenario, supply_facts, source_fingerprint) FROM stdin;
\.


--
-- Data for Name: purchase_gst_line_evidence; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_gst_line_evidence (id, tenant_id, purchase_invoice_id, evidence_revision_id, purchase_invoice_item_id, declared_taxable_value_raw, declared_cgst_raw, declared_sgst_raw, declared_igst_raw, declared_cess_raw, declared_line_total_raw, declared_taxable_value, declared_cgst, declared_sgst, declared_igst, declared_cess, declared_line_total) FROM stdin;
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

COPY public.purchase_invoice_items (id, tenant_id, purchase_id, product_id, batch_no, expiry_date, quantity, free_qty, purchase_rate, discount_pct, discount_amount, gst_rate, gst_amount, mrp, sale_rate, line_total, created_at) FROM stdin;
\.


--
-- Data for Name: purchase_invoices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_invoices (id, tenant_id, invoice_no, supplier_id, supplier_invoice_no, invoice_date, status, gst_reconciliation_status, gst_accounting_acceptance_status, current_gst_evidence_revision_id, current_gst_calculation_id, current_gst_accounting_decision_id, gst_record_version, gross_amount, total_discount, total_tax, round_off, net_amount, notes, created_by, finalized_at, cancelled_at, cancelled_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: purchase_posting_operations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_posting_operations (id, tenant_id, purchase_invoice_id, idempotency_key, request_payload_hash, status, result_invoice_no, result_purchase_id, created_at, updated_at) FROM stdin;
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
\.


--
-- Data for Name: supplier_ledgers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.supplier_ledgers (id, tenant_id, supplier_id, entry_type, debit, credit, balance, reference_type, reference_id, purchase_id, narration, entry_date, created_at) FROM stdin;
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.suppliers (id, tenant_id, code, business_name, contact_person, phone, mobile, email, address_1, address_2, city, state, pincode, gstin, drug_license_no, opening_balance, payable_balance, is_active, created_at, updated_at) FROM stdin;
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

\unrestrict l8kOzUbBZQmraS2O5kKpo5kXTlfq6PsJZGeyZw0UwqlgRBfFLMekVrIxspjI5Dx

