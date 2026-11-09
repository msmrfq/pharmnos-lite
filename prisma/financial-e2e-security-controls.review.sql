-- REVIEW ARTIFACT ONLY - DO NOT EXECUTE.
-- This file specifies the selected security controls for the existing local
-- disposable roles. It is intentionally not an executable provisioning file.
--
-- Supported principals, established by docker-compose.financial-e2e.yml and
-- the local credential work:
--   pharmnos_e2e          bootstrap/provisioning role
--   pharmnos_e2e_runtime  ordinary non-superuser/non-BYPASSRLS test role
--
-- No browser role, authenticated role, backend role, or separate function
-- owner is defined by this repository. A future executable artifact must
-- stop if it requires one of those principals.
--
-- Explicit per-table RLS specifications are maintained in
-- prisma/financial-e2e-rls-policies.review.sql. This file owns the privilege,
-- immutability, function, and posting-control contract; the two review
-- artifacts must be reviewed together.
--
-- Owner's Decision - controlled-function model (2026-10-25):
-- database-enforced trigger functions are owned by pharmnos_e2e and are not
-- caller-invocable SECURITY DEFINER APIs. No new function-owner role is
-- created or assumed by this package. Any future caller-invocable privileged
-- function requires a separate owner decision and role-provisioning review.
-- Rationale: preserves the existing two-role boundary and avoids silently
-- granting elevation. Consequence: service-led transitions remain required;
-- this package cannot provide privileged function-mediated writes.
--
-- Identity authenticity control:
-- The setting name is 'pharmnos.auth_context'. It is transaction-local input
-- only. RLS never trusts its contents directly. Public wrappers call the
-- bootstrap-owned SECURITY DEFINER verifier, which reads the private signing
-- key and validates the HMAC, version, subject, tenant, expiry, and active
-- subject-to-tenant membership. The runtime role has no access to the key
-- table or verifier function and cannot alter either security definition.
-- The executable verifier reads the untrusted input with
-- current_setting('pharmnos.auth_context', true).
-- Replay control is implemented by pharmnos_private.auth_context_replays,
-- txid_current(), and ON CONFLICT (nonce) DO NOTHING; a committed nonce reuse
-- in another transaction is rejected.
--
-- Authorization-table writes are restricted by the bootstrap-owned
-- public.financial_context_is_admin() SECURITY DEFINER helper. Runtime
-- memberships, roles, and role_permissions writes require an active signed
-- membership whose role has SystemRole ADMIN in the signed tenant.

BEGIN;

-- ---------------------------------------------------------------------------
-- Least privilege and default privileges
-- ---------------------------------------------------------------------------
-- The bootstrap role owns objects created by the baseline. It is not an
-- application runtime role. Runtime access is explicitly granted below.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO pharmnos_e2e_runtime;
REVOKE CREATE ON SCHEMA public FROM pharmnos_e2e_runtime;
REVOKE ALL ON TYPE public."FinancialDateBasis" FROM PUBLIC;
GRANT USAGE ON TYPE public."FinancialDateBasis" TO pharmnos_e2e_runtime;

ALTER DEFAULT PRIVILEGES FOR ROLE pharmnos_e2e IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE pharmnos_e2e IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE pharmnos_e2e IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Runtime reads and creates ordinary tenant-scoped records. It receives no
-- direct mutation or deletion privilege for immutable GST history.
-- The exact table list is generated from the current Prisma schema during
-- artifact review; no unrestricted role-wide DML is permitted.
GRANT SELECT, INSERT, UPDATE ON TABLE
  public.tenants, public.users, public.memberships, public.roles,
  public.role_permissions, public.business_profiles, public.products,
  public.product_batches, public.customers, public.suppliers,
  public.purchase_invoices, public.purchase_supplier_documents,
  public.purchase_invoice_items,
  public.sales_invoices, public.sales_posting_operations,
  public.sales_invoice_items, public.payments,
  public.payment_allocations, public.allocation_reversals,
  public.payment_refunds, public.payment_reversals,
  public.stock_movements, public.customer_ledgers, public.supplier_ledgers,
  public.audit_logs
TO pharmnos_e2e_runtime;

-- RLS, not the table grant alone, permits authorization-table writes only for
-- signed administrators. Ordinary members retain no route to self-escalate.

GRANT SELECT ON TABLE
  public.hsn_sac_catalog,
  public.gst_rate_rules
TO pharmnos_e2e_runtime;

GRANT SELECT, INSERT ON TABLE
  public.purchase_posting_operations,
  public.purchase_gst_evidence_revisions,
  public.purchase_gst_line_evidence,
  public.purchase_gst_calculations,
  public.purchase_gst_accounting_decisions,
  public.purchase_gst_reconciliation_events,
  public.purchase_gst_reconciliation_event_lines,
  public.inventory_valuation_decisions,
  public.inventory_valuation_adjustments,
  public.hsn_sac_catalog_history,
  public.gst_rate_rule_history
TO pharmnos_e2e_runtime;

REVOKE UPDATE, DELETE ON TABLE
  public.purchase_gst_evidence_revisions,
  public.purchase_gst_line_evidence,
  public.purchase_gst_calculations,
  public.purchase_gst_accounting_decisions,
  public.purchase_gst_reconciliation_events,
  public.purchase_gst_reconciliation_event_lines,
  public.inventory_valuation_decisions,
  public.inventory_valuation_adjustments,
  public.hsn_sac_catalog_history,
  public.gst_rate_rule_history
FROM pharmnos_e2e_runtime;

REVOKE DELETE ON TABLE
  public.tenants,
  public.audit_logs,
  public.purchase_invoices,
  public.purchase_invoice_items
FROM pharmnos_e2e_runtime;

-- No direct browser CRUD is granted. No anon/authenticated principal is
-- referenced because neither role exists in the local repository contract.

-- ---------------------------------------------------------------------------
-- RLS policy contract
-- ---------------------------------------------------------------------------
-- Each tenant_id predicate is fail-closed when the claim is absent, invalid,
-- or does not match the row. The claim is transaction-local and must be set
-- by the service before ordinary-role access.
--
-- The following policy family is required for every table with tenant_id.
-- users and role_permissions are relation-scoped exceptions because neither
-- model has a tenant_id column.
--   USING      (tenant_id::text = public.financial_context_tenant_id())
--   WITH CHECK (tenant_id::text = public.financial_context_tenant_id())
--
-- Required tenant-scoped tables:
-- tenants, users, memberships, roles, role_permissions, business_profiles, products,
-- product_batches, customers, suppliers, purchase_invoices,
-- purchase_posting_operations, purchase_invoice_items,
-- purchase_gst_evidence_revisions, purchase_gst_line_evidence,
-- purchase_gst_calculations, purchase_gst_accounting_decisions,
-- purchase_gst_reconciliation_events,
-- purchase_gst_reconciliation_event_lines, sales_invoices,
-- sales_posting_operations,
-- sales_invoice_items, payments, payment_allocations, allocation_reversals,
-- payment_refunds, payment_reversals, stock_movements, customer_ledgers,
-- supplier_ledgers, audit_logs.
-- hsn_sac_catalog_history, gst_rate_rule_history.
-- inventory_valuation_decisions, inventory_valuation_adjustments.
-- sales_posting_operations is tenant-scoped operation state and is protected
-- by the same tenant predicate and unique-key contract as purchase posting.
--
-- tenants is the root exception: use id::text instead of tenant_id::text.
-- role_permissions is relation-scoped because it has no tenant_id:
--   EXISTS (
--     SELECT 1 FROM public.roles r
--     WHERE r.id = role_permissions.role_id
--       AND r.tenant_id::text = public.financial_context_tenant_id()
--   )
--
-- Every listed table must receive:
--   ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE ... FORCE ROW LEVEL SECURITY;
--   a SELECT policy with the USING predicate;
--   INSERT/UPDATE policies with both USING and WITH CHECK;
--   no DELETE policy for immutable GST history.
--
-- Policy names must be deterministic:
--   tenant_select_<table>
--   tenant_insert_<table>
--   tenant_update_<table>
-- Decision C Option 1 intentionally defines no ordinary runtime DELETE
-- policy family for mutable or immutable tables.
--
-- The final executable artifact must expand this contract into explicit
-- statements and must stop if any listed table or column is missing.

-- ---------------------------------------------------------------------------
-- Controlled functions and safe search path
-- ---------------------------------------------------------------------------
-- No caller-invocable controlled function is executable from this review
-- artifact. Trigger functions are owned by the bootstrap role and are not
-- granted as application APIs. If a separately approved caller-invocable
-- function path is added, its owner must be separately approved, and its
-- definition must include:
--   SECURITY DEFINER
--   SET search_path = pg_catalog, public
--   explicit argument types
--   no dynamic SQL from caller input
--   explicit tenant and state checks
--   EXECUTE granted only to pharmnos_e2e_runtime
--   REVOKE EXECUTE FROM PUBLIC
--
-- The runtime role must never own a SECURITY DEFINER function and must never
-- receive schema CREATE or function ownership privileges.

-- ---------------------------------------------------------------------------
-- Database-enforced immutable history
-- ---------------------------------------------------------------------------
-- The final executable artifact must install an owner-controlled trigger
-- function that raises SQLSTATE 42501 for UPDATE or DELETE on:
--   purchase_gst_evidence_revisions
--   purchase_gst_line_evidence
--   purchase_gst_calculations
--   purchase_gst_accounting_decisions
--   purchase_gst_reconciliation_events
--   purchase_gst_reconciliation_event_lines
--   inventory_valuation_decisions
--   inventory_valuation_adjustments
--   hsn_sac_catalog_history
--   gst_rate_rule_history
--
-- Corrections are INSERT-only revisions/events. Supplier-declared,
-- calculated, and accounting-accepted values remain separate.
-- HSN/SAC and GST rule history use the same trigger contract. Approved GST
-- rate rules are immutable; changes must be represented by pending revisions.
--
-- Finalized purchase history is guarded by:
--   prevent_finalized_purchase_mutation
--     BEFORE UPDATE OR DELETE ON purchase_invoices
--   prevent_finalized_purchase_item_mutation
--     BEFORE UPDATE OR DELETE ON purchase_invoice_items
-- The parent guard protects invoice_no, gross_amount, total_discount,
-- total_tax, round_off, net_amount, finalized_at, GST pointers/statuses, and
-- gst_record_version once the controlled finalization completion is recorded.
-- The item guard protects the invoice facts, calculated tax components,
-- accepted_taxable_value, accepted_cgst, accepted_sgst, accepted_igst,
-- accepted_cess, accepted_line_total, accepted_value_source,
-- accepted_reason, accepted_at, accepted_by_membership_id,
-- accepted_decision_id, GST acceptance metadata, gst_amount, and line_total.
-- The item lookup is tenant-qualified by purchase_id and tenant_id. Draft
-- rows remain editable; the finalization transaction may complete its
-- controlled parent/item writes before finalized_at is set. Post-finalization
-- valuation denormalizations remain separately governed. Neither trigger
-- permits finalized-row deletion, and the runtime role has no DELETE grant.

-- Financial date controls added by migration 0028:
--   assign_financial_recorded_at assigns recorded_at with clock_timestamp()
--   on INSERT for payments, both ledgers, allocations, and reversals;
--   guard_invoice_financial_dates assigns finalized_recorded_at on the
--   finalization transition for both invoice tables; and
--   guard_refund_financial_dates assigns request acceptance time on INSERT and
--   completion acceptance time only on the transition to COMPLETED.
-- These functions never derive or overwrite effective_date, due_date_business,
-- or occurred_at. The event producer captures one operation instant and
-- supplies the corresponding occurred_at/effective_date pair, sharing it
-- between the financial event and its ledger entry. Existing rows remain NULL;
-- no historical dates or recorded times are backfilled.
-- Recorded-time guarantee: clock_timestamp() is the database server wall clock
-- while the statement executes inside a still-open transaction, i.e. BEFORE
-- commit. It is not commit-visible time, not commit order, and not proof of
-- what was known at that instant; callers cannot supply or rewrite it, and
-- every such column carries a COMMENT ON COLUMN stating this.

-- ---------------------------------------------------------------------------
-- Guarded posting transitions and idempotency
-- ---------------------------------------------------------------------------
-- Structural controls already present in Prisma:
--   UNIQUE (tenant_id, idempotency_key)
--   UNIQUE (tenant_id, purchase_invoice_id)
--   INDEX  (tenant_id, purchase_invoice_id, status)
--
-- The final executable artifact must add an owner-controlled transition
-- trigger or function allowing only:
--   PROCESSING -> COMPLETED
--   PROCESSING -> FAILED
-- and rejecting all other direct status changes with SQLSTATE 23514.
-- It must reject COMPLETED/FAILED records whose invoice or tenant differs
-- from the operation row. Request-payload hash conflict detection and
-- atomic invoice/stock/ledger/audit writes remain service-transaction
-- responsibilities.

-- This review artifact never changes database state.
ROLLBACK;