-- Generated offline from the current Prisma schema plus checked HSN/SAC governance controls; complete baseline.

-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('ADMIN', 'BILLING', 'INVENTORY', 'MANAGER');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('manage_users', 'manage_roles', 'manage_business_profile', 'create_product', 'edit_product', 'view_product', 'manage_hsn_catalog', 'approve_hsn_catalog', 'approve_gst_rates', 'create_customer', 'edit_customer', 'view_customer', 'create_supplier', 'edit_supplier', 'view_supplier', 'create_purchase', 'edit_purchase', 'view_purchase', 'accept_purchase_gst', 'finalize_purchase', 'create_invoice', 'edit_invoice', 'view_invoice', 'finalize_invoice', 'cancel_invoice', 'create_payment', 'view_inventory', 'adjust_stock', 'manage_batches', 'view_customer_ledger', 'view_supplier_ledger', 'view_reports', 'view_audit_log');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'FINALIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaxDataStatus" AS ENUM ('UNVERIFIED_DRAFT', 'COMPLETE', 'LEGACY_AGGREGATE_ONLY', 'PARTIAL', 'UNRESOLVED');

-- CreateEnum
CREATE TYPE "PurchaseGstReconciliationStatus" AS ENUM ('NOT_RECONCILED', 'MATCHED', 'DISCREPANCY_REQUIRES_REVIEW', 'RESOLVED');

-- CreateEnum
CREATE TYPE "PurchaseGstAccountingAcceptanceStatus" AS ENUM ('NOT_ACCEPTED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "InventoryValuationDecisionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED', 'REVERSED');

-- CreateEnum
CREATE TYPE "InventoryValuationAccountingStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING_POLICY', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "InventoryValuationAdjustmentKind" AS ENUM ('CORRECTION', 'REVERSAL');

-- CreateEnum
CREATE TYPE "PurchaseGstEvidenceRevisionKind" AS ENUM ('INITIAL', 'CORRECTION');

-- CreateEnum
CREATE TYPE "PurchaseGstReconciliationEventKind" AS ENUM ('EVIDENCE_CAPTURED', 'CALCULATION_RECORDED', 'MATCHED', 'DISCREPANCY_REQUIRES_REVIEW', 'RESOLVED', 'ACCOUNTING_ACCEPTED', 'CORRECTED');

-- CreateEnum
CREATE TYPE "GstApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'CARD', 'UPI', 'CHEQUE', 'BANK_TRANSFER', 'NEFT', 'CREDIT', 'MIXED');

-- CreateEnum
CREATE TYPE "FinancialRefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinancialReversalStatus" AS ENUM ('COMPLETED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE_IN', 'SALE_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'SALES_RETURN_IN', 'PURCHASE_RETURN_OUT', 'OPENING_STOCK');

-- CreateEnum
CREATE TYPE "ScheduleClass" AS ENUM ('H', 'H1', 'X', 'SCHEDULE_H', 'SCHEDULE_H1', 'SCHEDULE_X', 'OTC', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('AUTH_LOGIN', 'AUTH_LOGOUT', 'USER_INVITED', 'USER_ROLE_CHANGED', 'BUSINESS_PROFILE_UPDATED', 'INVOICE_CREATED', 'INVOICE_FINALIZED', 'INVOICE_CANCELLED', 'PURCHASE_CREATED', 'PURCHASE_FINALIZED', 'STOCK_ADJUSTED', 'PRICE_UPDATED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'CUSTOMER_DEACTIVATED', 'SUPPLIER_DEACTIVATED', 'ALLOCATION_CREATED', 'ALLOCATION_REVERSED', 'REFUND_REQUESTED', 'REFUND_APPROVED', 'REFUND_REJECTED', 'REFUND_CANCELLED', 'REFUND_COMPLETED', 'PAYMENT_REVERSED');

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
    "inventory_acquisition_cost" DECIMAL(20,4),
    "inventory_valuation_status" TEXT NOT NULL DEFAULT 'PENDING',
    "inventory_valuation_policy_version" TEXT,
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
    "due_date" TIMESTAMP(3),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "gst_reconciliation_status" "PurchaseGstReconciliationStatus" NOT NULL DEFAULT 'NOT_RECONCILED',
    "gst_accounting_acceptance_status" "PurchaseGstAccountingAcceptanceStatus" NOT NULL DEFAULT 'NOT_ACCEPTED',
    "gst_treatment" TEXT,
    "tax_mode" TEXT DEFAULT 'EXCLUSIVE',
    "current_gst_evidence_revision_id" TEXT,
    "current_gst_calculation_id" TEXT,
    "current_gst_accounting_decision_id" TEXT,
    "gst_record_version" INTEGER NOT NULL DEFAULT 0,
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
    "finalized_snapshot" JSONB,
    "finalized_snapshot_hash" TEXT,
    "rendering_version" TEXT,
    "pdf_artifact_key" TEXT,
    "pdf_generation_status" TEXT NOT NULL DEFAULT 'PENDING',
    "pdf_generated_at" TIMESTAMP(3),
    "pdf_rendering_version" TEXT,
    "pdf_byte_size" INTEGER,
    "pdf_checksum_sha256" TEXT,
    "pdf_error" TEXT,

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_supplier_documents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "purchase_invoice_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersedes_id" TEXT,
    "replaced_at" TIMESTAMP(3),

    CONSTRAINT "purchase_supplier_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_posting_operations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "purchase_invoice_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_payload_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "result_invoice_no" TEXT,
    "result_purchase_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_posting_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hsn_sac_catalog" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "classification_type" TEXT,
    "classification_metadata" JSONB,
    "classification_status" "GstApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "rate_approval_status" "GstApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "source_reference" TEXT,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_by_membership_id" TEXT,
    "updated_by_membership_id" TEXT,
    "classification_approved_by_membership_id" TEXT,
    "classification_approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hsn_sac_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hsn_sac_catalog_history" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "catalog_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "actor_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hsn_sac_catalog_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_rate_rules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "hsn_sac_catalog_id" TEXT,
    "rule_version" TEXT NOT NULL,
    "tax_rate" DECIMAL(7,4),
    "component_policy" TEXT NOT NULL,
    "approval_status" "GstApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "source_reference" TEXT,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_by_membership_id" TEXT,
    "approved_by_membership_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gst_rate_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_rate_rule_history" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "actor_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_rate_rule_history_pkey" PRIMARY KEY ("id")
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
    "hsn_code_snapshot" TEXT,
    "hsn_sac_catalog_id_snapshot" TEXT,
    "gst_rule_version_snapshot" TEXT,
    "gst_rule_source_reference_snapshot" TEXT,
    "calculated_taxable_value" DECIMAL(20,4),
    "calculated_cgst" DECIMAL(20,4),
    "calculated_sgst" DECIMAL(20,4),
    "calculated_igst" DECIMAL(20,4),
    "calculated_cess" DECIMAL(20,4),
    "accepted_taxable_value" DECIMAL(20,4),
    "accepted_cgst" DECIMAL(20,4),
    "accepted_sgst" DECIMAL(20,4),
    "accepted_igst" DECIMAL(20,4),
    "accepted_cess" DECIMAL(20,4),
    "accepted_line_total" DECIMAL(20,4),
    "accepted_value_source" TEXT,
    "accepted_reason" TEXT,
    "accepted_at" TIMESTAMP(3),
    "accepted_by_membership_id" TEXT,
    "accepted_decision_id" TEXT,
    "recoverable_itc" DECIMAL(20,4),
    "non_recoverable_gst" DECIMAL(20,4),
    "inventory_acquisition_cost" DECIMAL(20,4),
    "inventory_valuation_status" TEXT NOT NULL DEFAULT 'PENDING',
    "inventory_valuation_policy_version" TEXT,
    "gst_acceptance_status" TEXT NOT NULL DEFAULT 'NOT_ACCEPTED',
    "gst_discrepancy_details" JSONB,
    "gst_calculation_reference" TEXT,
    "gst_acceptance_reference" TEXT,
    "mrp" DECIMAL(12,2),
    "sale_rate" DECIMAL(12,2),
    "line_total" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_valuation_decisions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "purchase_invoice_id" TEXT NOT NULL,
    "purchase_invoice_item_id" TEXT NOT NULL,
    "product_batch_id" TEXT NOT NULL,
    "stock_movement_id" TEXT,
    "status" "InventoryValuationDecisionStatus" NOT NULL DEFAULT 'PENDING',
    "accounting_status" "InventoryValuationAccountingStatus" NOT NULL DEFAULT 'PENDING_POLICY',
    "eligibility_status" TEXT NOT NULL,
    "accepted_taxable_value" DECIMAL(20,4) NOT NULL,
    "accepted_gst" DECIMAL(20,4) NOT NULL,
    "recoverable_itc" DECIMAL(65,30),
    "non_recoverable_gst" DECIMAL(65,30),
    "direct_acquisition_cost" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "inventory_acquisition_cost" DECIMAL(65,30),
    "policy_version" TEXT NOT NULL,
    "decision_reference" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_payload_hash" TEXT NOT NULL,
    "supersedes_decision_id" TEXT,
    "decided_by_membership_id" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_valuation_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_valuation_adjustments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "prior_decision_id" TEXT NOT NULL,
    "resulting_decision_id" TEXT NOT NULL,
    "adjustment_kind" "InventoryValuationAdjustmentKind" NOT NULL,
    "recoverable_itc_delta" DECIMAL(20,4) NOT NULL,
    "non_recoverable_gst_delta" DECIMAL(20,4) NOT NULL,
    "inventory_cost_delta" DECIMAL(20,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_payload_hash" TEXT NOT NULL,
    "adjusted_by_membership_id" TEXT NOT NULL,
    "adjusted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_valuation_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_gst_evidence_revisions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "purchase_invoice_id" TEXT NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "revision_kind" "PurchaseGstEvidenceRevisionKind" NOT NULL,
    "supersedes_revision_id" TEXT,
    "source_document_reference" TEXT,
    "capture_channel" TEXT NOT NULL,
    "capture_provenance" JSONB,
    "correction_reason" TEXT,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "captured_by_membership_id" TEXT NOT NULL,
    "declared_taxable_value_raw" TEXT,
    "declared_cgst_raw" TEXT,
    "declared_sgst_raw" TEXT,
    "declared_igst_raw" TEXT,
    "declared_cess_raw" TEXT,
    "declared_invoice_total_raw" TEXT,
    "declared_round_off_raw" TEXT,
    "declared_taxable_value" DECIMAL(20,4),
    "declared_cgst" DECIMAL(20,4),
    "declared_sgst" DECIMAL(20,4),
    "declared_igst" DECIMAL(20,4),
    "declared_cess" DECIMAL(20,4),
    "declared_invoice_total" DECIMAL(20,4),
    "declared_round_off" DECIMAL(20,4),
    "supplier_state_at_transaction" TEXT,
    "recipient_state_at_transaction" TEXT,
    "delivery_state_at_transaction" TEXT,
    "supply_scenario" TEXT,
    "supply_facts" JSONB,
    "source_fingerprint" TEXT,

    CONSTRAINT "purchase_gst_evidence_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_gst_line_evidence" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "purchase_invoice_id" TEXT NOT NULL,
    "evidence_revision_id" TEXT NOT NULL,
    "purchase_invoice_item_id" TEXT NOT NULL,
    "declared_taxable_value_raw" TEXT,
    "declared_cgst_raw" TEXT,
    "declared_sgst_raw" TEXT,
    "declared_igst_raw" TEXT,
    "declared_cess_raw" TEXT,
    "declared_line_total_raw" TEXT,
    "declared_taxable_value" DECIMAL(20,4),
    "declared_cgst" DECIMAL(20,4),
    "declared_sgst" DECIMAL(20,4),
    "declared_igst" DECIMAL(20,4),
    "declared_cess" DECIMAL(20,4),
    "declared_line_total" DECIMAL(20,4),

    CONSTRAINT "purchase_gst_line_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_gst_calculations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "purchase_invoice_id" TEXT NOT NULL,
    "evidence_revision_id" TEXT NOT NULL,
    "rule_version" TEXT NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculation_provenance" JSONB,
    "input_fingerprint" TEXT,
    "calculated_taxable_value" DECIMAL(20,4),
    "calculated_cgst" DECIMAL(20,4),
    "calculated_sgst" DECIMAL(20,4),
    "calculated_igst" DECIMAL(20,4),
    "calculated_cess" DECIMAL(20,4),
    "calculated_invoice_total" DECIMAL(20,4),
    "calculated_round_off" DECIMAL(20,4),

    CONSTRAINT "purchase_gst_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_gst_accounting_decisions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "purchase_invoice_id" TEXT NOT NULL,
    "evidence_revision_id" TEXT NOT NULL,
    "calculation_id" TEXT NOT NULL,
    "accepted_taxable_value" DECIMAL(20,4),
    "accepted_cgst" DECIMAL(20,4),
    "accepted_sgst" DECIMAL(20,4),
    "accepted_igst" DECIMAL(20,4),
    "accepted_cess" DECIMAL(20,4),
    "accepted_invoice_total" DECIMAL(20,4),
    "accepted_round_off" DECIMAL(20,4),
    "accepted_value_source" TEXT NOT NULL,
    "decision_reference" TEXT NOT NULL,
    "decision_outcome" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by_membership_id" TEXT NOT NULL,

    CONSTRAINT "purchase_gst_accounting_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_gst_reconciliation_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "purchase_invoice_id" TEXT NOT NULL,
    "evidence_revision_id" TEXT NOT NULL,
    "event_kind" "PurchaseGstReconciliationEventKind" NOT NULL,
    "from_status" "PurchaseGstReconciliationStatus",
    "to_status" "PurchaseGstReconciliationStatus",
    "operation" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_payload_hash" TEXT,
    "decision_reference" TEXT,
    "rule_version" TEXT,
    "actor_membership_id" TEXT,
    "declared_snapshot" JSONB,
    "calculated_snapshot" JSONB,
    "accepted_snapshot" JSONB,
    "discrepancy_details" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_gst_reconciliation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_gst_reconciliation_event_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "purchase_invoice_id" TEXT NOT NULL,
    "evidence_revision_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "line_evidence_id" TEXT NOT NULL,

    CONSTRAINT "purchase_gst_reconciliation_event_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "customer_id" TEXT,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "tax_data_status" "TaxDataStatus",
    "gst_treatment" TEXT,
    "tax_mode" TEXT DEFAULT 'EXCLUSIVE',
    "place_of_supply_code" TEXT,
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
    "seller_name_snapshot" TEXT,
    "seller_address_line_1_snapshot" TEXT,
    "seller_address_line_2_snapshot" TEXT,
    "seller_city_snapshot" TEXT,
    "seller_state_snapshot" TEXT,
    "seller_pincode_snapshot" TEXT,
    "seller_gstin_snapshot" TEXT,
    "customer_name_snapshot" TEXT,
    "customer_address_line_1_snapshot" TEXT,
    "customer_address_line_2_snapshot" TEXT,
    "customer_city_snapshot" TEXT,
    "customer_state_snapshot" TEXT,
    "customer_pincode_snapshot" TEXT,
    "customer_gstin_snapshot" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "finalized_snapshot" JSONB,
    "finalized_snapshot_hash" TEXT,
    "rendering_version" TEXT,
    "pdf_artifact_key" TEXT,
    "pdf_generation_status" TEXT NOT NULL DEFAULT 'PENDING',
    "pdf_generated_at" TIMESTAMP(3),
    "pdf_rendering_version" TEXT,
    "pdf_byte_size" INTEGER,
    "pdf_checksum_sha256" TEXT,
    "pdf_error" TEXT,

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_posting_operations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sales_invoice_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_payload_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "result_invoice_no" TEXT,
    "result_sales_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_posting_operations_pkey" PRIMARY KEY ("id")
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
    "taxable_amount" DECIMAL(14,2),
    "gst_rate" DECIMAL(5,2) NOT NULL,
    "gst_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(12,2),
    "sgst_amount" DECIMAL(12,2),
    "igst_amount" DECIMAL(12,2),
    "cess_amount" DECIMAL(12,2),
    "hsn_sac_catalog_id_snapshot" TEXT,
    "gst_rule_version_snapshot" TEXT,
    "gst_rule_source_reference_snapshot" TEXT,
    "product_name_snapshot" TEXT,
    "generic_name_snapshot" TEXT,
    "hsn_code_snapshot" TEXT,
    "batch_expiry_snapshot" TIMESTAMP(3),
    "line_total" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "supplier_id" TEXT,
    "invoice_id" TEXT,
    "entry_type" "LedgerEntryType" NOT NULL,
    "payment_mode" "PaymentMode",
    "amount" DECIMAL(14,2) NOT NULL,
    "reference_no" TEXT,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "idempotency_key" TEXT,
    "request_payload_hash" TEXT,
    "receipt_no" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_receipt_sequences" (
    "tenant_id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "next_value" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "payment_receipt_sequences_pkey" PRIMARY KEY ("tenant_id","prefix"),
    CONSTRAINT "payment_receipt_sequences_next_value_check"
    CHECK ("next_value" > 0)
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "sales_invoice_id" TEXT,
    "purchase_invoice_id" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_payload_hash" TEXT NOT NULL,
    "allocated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allocated_by" TEXT,
    "legacy_unallocated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_reversals" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "allocation_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_payload_hash" TEXT NOT NULL,
    "reversed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allocation_reversals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_refunds" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "FinancialRefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "idempotency_key" TEXT NOT NULL,
    "request_payload_hash" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "requested_by" TEXT,
    "approved_by" TEXT,
    "rejected_by" TEXT,
    "completed_by" TEXT,
    "cancelled_by" TEXT,
    "reason" TEXT,
    "resolution_reason" TEXT,

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_reversals" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "FinancialReversalStatus" NOT NULL DEFAULT 'COMPLETED',
    "idempotency_key" TEXT NOT NULL,
    "request_payload_hash" TEXT NOT NULL,
    "reversed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversed_by" TEXT,
    "reason" TEXT,

    CONSTRAINT "payment_reversals_pkey" PRIMARY KEY ("id")
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
    "inventory_acquisition_cost" DECIMAL(20,4),
    "inventory_valuation_status" TEXT NOT NULL DEFAULT 'PENDING',
    "inventory_valuation_policy_version" TEXT,
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
CREATE UNIQUE INDEX "memberships_tenant_id_id_key" ON "memberships"("tenant_id", "id");

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
CREATE UNIQUE INDEX "product_batches_tenant_id_id_key" ON "product_batches"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "customers_tenant_id_idx" ON "customers"("tenant_id");

-- CreateIndex
CREATE INDEX "customers_tenant_id_business_name_idx" ON "customers"("tenant_id", "business_name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_code_key" ON "customers"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_id_key" ON "customers"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "suppliers_tenant_id_idx" ON "suppliers"("tenant_id");

-- CreateIndex
CREATE INDEX "suppliers_tenant_id_business_name_idx" ON "suppliers"("tenant_id", "business_name");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_tenant_id_code_key" ON "suppliers"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_tenant_id_id_key" ON "suppliers"("tenant_id", "id");

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
CREATE UNIQUE INDEX "purchase_invoices_tenant_id_id_key" ON "purchase_invoices"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_tenant_id_id_current_gst_evidence_revisio_key" ON "purchase_invoices"("tenant_id", "id", "current_gst_evidence_revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_tenant_id_id_current_gst_calculation_id_key" ON "purchase_invoices"("tenant_id", "id", "current_gst_calculation_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_tenant_id_id_current_gst_accounting_decis_key" ON "purchase_invoices"("tenant_id", "id", "current_gst_accounting_decision_id");

-- CreateIndex
CREATE INDEX "purchase_supplier_documents_tenant_id_purchase_invoice_id_u_idx" ON "purchase_supplier_documents"("tenant_id", "purchase_invoice_id", "uploaded_at");

-- CreateIndex
CREATE INDEX "purchase_supplier_documents_tenant_id_supplier_id_uploaded__idx" ON "purchase_supplier_documents"("tenant_id", "supplier_id", "uploaded_at");

-- CreateIndex
CREATE INDEX "purchase_supplier_documents_tenant_id_supersedes_id_idx" ON "purchase_supplier_documents"("tenant_id", "supersedes_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_supplier_documents_tenant_id_id_key" ON "purchase_supplier_documents"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "purchase_posting_operations_tenant_id_purchase_invoice_id_s_idx" ON "purchase_posting_operations"("tenant_id", "purchase_invoice_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_posting_idempotency_key" ON "purchase_posting_operations"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_posting_purchase_key" ON "purchase_posting_operations"("tenant_id", "purchase_invoice_id");

-- CreateIndex
CREATE INDEX "hsn_sac_catalog_tenant_id_is_active_idx" ON "hsn_sac_catalog"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "hsn_sac_catalog_tenant_id_classification_status_rate_approv_idx" ON "hsn_sac_catalog"("tenant_id", "classification_status", "rate_approval_status");

-- CreateIndex
CREATE UNIQUE INDEX "hsn_sac_catalog_tenant_id_code_key" ON "hsn_sac_catalog"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "hsn_sac_catalog_tenant_id_id_key" ON "hsn_sac_catalog"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "hsn_sac_catalog_history_tenant_id_catalog_id_created_at_idx" ON "hsn_sac_catalog_history"("tenant_id", "catalog_id", "created_at");

-- CreateIndex
CREATE INDEX "gst_rate_rules_tenant_id_hsn_sac_catalog_id_effective_from__idx" ON "gst_rate_rules"("tenant_id", "hsn_sac_catalog_id", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "gst_rate_rules_tenant_id_approval_status_is_active_idx" ON "gst_rate_rules"("tenant_id", "approval_status", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "gst_rate_rules_tenant_id_rule_version_key" ON "gst_rate_rules"("tenant_id", "rule_version");

-- CreateIndex
CREATE UNIQUE INDEX "gst_rate_rules_tenant_id_id_key" ON "gst_rate_rules"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "gst_rate_rule_history_tenant_id_rule_id_created_at_idx" ON "gst_rate_rule_history"("tenant_id", "rule_id", "created_at");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_tenant_id_idx" ON "purchase_invoice_items"("tenant_id");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_purchase_id_idx" ON "purchase_invoice_items"("purchase_id");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_product_id_idx" ON "purchase_invoice_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoice_items_tenant_id_purchase_id_id_key" ON "purchase_invoice_items"("tenant_id", "purchase_id", "id");

-- CreateIndex
CREATE INDEX "inventory_valuation_decisions_tenant_id_purchase_invoice_id_idx" ON "inventory_valuation_decisions"("tenant_id", "purchase_invoice_id", "purchase_invoice_item_id");

-- CreateIndex
CREATE INDEX "inventory_valuation_decisions_tenant_id_product_batch_id_cr_idx" ON "inventory_valuation_decisions"("tenant_id", "product_batch_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_valuation_decisions_tenant_id_status_created_at_idx" ON "inventory_valuation_decisions"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_valuation_decisions_tenant_id_id_key" ON "inventory_valuation_decisions"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_valuation_decision_idempotency_key" ON "inventory_valuation_decisions"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "inventory_valuation_adjustments_tenant_id_prior_decision_id_idx" ON "inventory_valuation_adjustments"("tenant_id", "prior_decision_id");

-- CreateIndex
CREATE INDEX "inventory_valuation_adjustments_tenant_id_resulting_decisio_idx" ON "inventory_valuation_adjustments"("tenant_id", "resulting_decision_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_valuation_adjustments_tenant_id_id_key" ON "inventory_valuation_adjustments"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_valuation_adjustment_idempotency_key" ON "inventory_valuation_adjustments"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "purchase_gst_evidence_captured_at_idx" ON "purchase_gst_evidence_revisions"("tenant_id", "purchase_invoice_id", "captured_at");

-- CreateIndex
CREATE INDEX "purchase_gst_evidence_revision_kind_idx" ON "purchase_gst_evidence_revisions"("tenant_id", "purchase_invoice_id", "revision_kind");

-- CreateIndex
CREATE INDEX "purchase_gst_evidence_supersedes_idx" ON "purchase_gst_evidence_revisions"("tenant_id", "purchase_invoice_id", "supersedes_revision_id");

-- CreateIndex
CREATE INDEX "purchase_gst_evidence_revisions_tenant_id_source_fingerprin_idx" ON "purchase_gst_evidence_revisions"("tenant_id", "source_fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_gst_evidence_revision_identity_key" ON "purchase_gst_evidence_revisions"("tenant_id", "purchase_invoice_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_gst_evidence_revision_number_key" ON "purchase_gst_evidence_revisions"("tenant_id", "purchase_invoice_id", "revision_number");

-- CreateIndex
CREATE INDEX "purchase_gst_line_evidence_tenant_id_purchase_invoice_id_pu_idx" ON "purchase_gst_line_evidence"("tenant_id", "purchase_invoice_id", "purchase_invoice_item_id");

-- CreateIndex
CREATE INDEX "purchase_gst_line_evidence_tenant_id_purchase_invoice_id_ev_idx" ON "purchase_gst_line_evidence"("tenant_id", "purchase_invoice_id", "evidence_revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_gst_line_evidence_tenant_id_purchase_invoice_id_ev_key" ON "purchase_gst_line_evidence"("tenant_id", "purchase_invoice_id", "evidence_revision_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_gst_line_evidence_tenant_id_evidence_revision_id_p_key" ON "purchase_gst_line_evidence"("tenant_id", "evidence_revision_id", "purchase_invoice_item_id");

-- CreateIndex
CREATE INDEX "purchase_gst_calculations_tenant_id_purchase_invoice_id_evi_idx" ON "purchase_gst_calculations"("tenant_id", "purchase_invoice_id", "evidence_revision_id");

-- CreateIndex
CREATE INDEX "purchase_gst_calculations_tenant_id_rule_version_idx" ON "purchase_gst_calculations"("tenant_id", "rule_version");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_gst_calculations_tenant_id_purchase_invoice_id_id_key" ON "purchase_gst_calculations"("tenant_id", "purchase_invoice_id", "id");

-- CreateIndex
CREATE INDEX "purchase_gst_accounting_decisions_tenant_id_purchase_invoic_idx" ON "purchase_gst_accounting_decisions"("tenant_id", "purchase_invoice_id", "evidence_revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_gst_decision_identity_key" ON "purchase_gst_accounting_decisions"("tenant_id", "purchase_invoice_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_gst_decision_reference_key" ON "purchase_gst_accounting_decisions"("tenant_id", "purchase_invoice_id", "evidence_revision_id", "decision_reference");

-- CreateIndex
CREATE INDEX "purchase_gst_reconciliation_events_tenant_id_purchase_invoi_idx" ON "purchase_gst_reconciliation_events"("tenant_id", "purchase_invoice_id", "created_at");

-- CreateIndex
CREATE INDEX "purchase_gst_reconciliation_events_tenant_id_evidence_revis_idx" ON "purchase_gst_reconciliation_events"("tenant_id", "evidence_revision_id", "created_at");

-- CreateIndex
CREATE INDEX "purchase_gst_reconciliation_events_tenant_id_event_kind_cre_idx" ON "purchase_gst_reconciliation_events"("tenant_id", "event_kind", "created_at");

-- CreateIndex
CREATE INDEX "purchase_gst_reconciliation_events_tenant_id_actor_membersh_idx" ON "purchase_gst_reconciliation_events"("tenant_id", "actor_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_gst_reconciliation_events_tenant_id_purchase_invoi_key" ON "purchase_gst_reconciliation_events"("tenant_id", "purchase_invoice_id", "evidence_revision_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_gst_reconciliation_events_tenant_id_operation_idem_key" ON "purchase_gst_reconciliation_events"("tenant_id", "operation", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_gst_event_line_identity_key" ON "purchase_gst_reconciliation_event_lines"("tenant_id", "purchase_invoice_id", "evidence_revision_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_gst_event_line_pair_key" ON "purchase_gst_reconciliation_event_lines"("tenant_id", "purchase_invoice_id", "evidence_revision_id", "event_id", "line_evidence_id");

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
CREATE UNIQUE INDEX "sales_invoices_tenant_id_id_key" ON "sales_invoices"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "sales_posting_operations_tenant_id_sales_invoice_id_status_idx" ON "sales_posting_operations"("tenant_id", "sales_invoice_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_posting_idempotency_key" ON "sales_posting_operations"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "sales_posting_invoice_key" ON "sales_posting_operations"("tenant_id", "sales_invoice_id");

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
CREATE INDEX "payments_tenant_id_supplier_id_idx" ON "payments"("tenant_id", "supplier_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_invoice_id_idx" ON "payments"("tenant_id", "invoice_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_payment_date_idx" ON "payments"("tenant_id", "payment_date");

-- CreateIndex
CREATE UNIQUE INDEX "payments_tenant_idempotency_key" ON "payments"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "payments_tenant_receipt_no" ON "payments"("tenant_id", "receipt_no");

-- CreateIndex
CREATE UNIQUE INDEX "payments_tenant_id_id_key" ON "payments"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "payment_allocations_tenant_id_payment_id_allocated_at_idx" ON "payment_allocations"("tenant_id", "payment_id", "allocated_at");

-- CreateIndex
CREATE INDEX "payment_allocations_tenant_id_sales_invoice_id_allocated_at_idx" ON "payment_allocations"("tenant_id", "sales_invoice_id", "allocated_at");

-- CreateIndex
CREATE INDEX "payment_allocations_tenant_id_purchase_invoice_id_allocated_idx" ON "payment_allocations"("tenant_id", "purchase_invoice_id", "allocated_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_tenant_id_id_key" ON "payment_allocations"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_tenant_idempotency_key" ON "payment_allocations"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "allocation_reversals_tenant_id_allocation_id_reversed_at_idx" ON "allocation_reversals"("tenant_id", "allocation_id", "reversed_at");

-- CreateIndex
CREATE INDEX "allocation_reversals_tenant_id_reversed_at_idx" ON "allocation_reversals"("tenant_id", "reversed_at");

-- CreateIndex
CREATE UNIQUE INDEX "allocation_reversals_tenant_idempotency_key" ON "allocation_reversals"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "payment_refunds_tenant_id_payment_id_status_idx" ON "payment_refunds"("tenant_id", "payment_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_refunds_tenant_id_id_key" ON "payment_refunds"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_refunds_tenant_idempotency_key" ON "payment_refunds"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "payment_reversals_tenant_id_reversed_at_idx" ON "payment_reversals"("tenant_id", "reversed_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_reversal_once" ON "payment_reversals"("tenant_id", "payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_reversals_tenant_idempotency_key" ON "payment_reversals"("tenant_id", "idempotency_key");

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
CREATE UNIQUE INDEX "stock_movements_tenant_id_id_key" ON "stock_movements"("tenant_id", "id");

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
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_current_gst_evidence_fkey" FOREIGN KEY ("tenant_id", "id", "current_gst_evidence_revision_id") REFERENCES "purchase_gst_evidence_revisions"("tenant_id", "purchase_invoice_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_current_gst_calculation_fkey" FOREIGN KEY ("tenant_id", "id", "current_gst_calculation_id") REFERENCES "purchase_gst_calculations"("tenant_id", "purchase_invoice_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_current_gst_accounting_decision_fkey" FOREIGN KEY ("tenant_id", "id", "current_gst_accounting_decision_id") REFERENCES "purchase_gst_accounting_decisions"("tenant_id", "purchase_invoice_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_supplier_documents" ADD CONSTRAINT "purchase_supplier_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_supplier_documents" ADD CONSTRAINT "purchase_supplier_documents_tenant_id_purchase_invoice_id_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id") REFERENCES "purchase_invoices"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_supplier_documents" ADD CONSTRAINT "purchase_supplier_documents_tenant_id_supplier_id_fkey" FOREIGN KEY ("tenant_id", "supplier_id") REFERENCES "suppliers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_supplier_documents" ADD CONSTRAINT "purchase_supplier_documents_tenant_id_supersedes_id_fkey" FOREIGN KEY ("tenant_id", "supersedes_id") REFERENCES "purchase_supplier_documents"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_posting_operations" ADD CONSTRAINT "purchase_posting_operations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_posting_operations" ADD CONSTRAINT "purchase_posting_operations_tenant_id_purchase_invoice_id_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id") REFERENCES "purchase_invoices"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hsn_sac_catalog" ADD CONSTRAINT "hsn_sac_catalog_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hsn_sac_catalog" ADD CONSTRAINT "hsn_sac_catalog_tenant_id_classification_approved_by_membe_fkey" FOREIGN KEY ("tenant_id", "classification_approved_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hsn_sac_catalog_history" ADD CONSTRAINT "hsn_sac_catalog_history_tenant_id_catalog_id_fkey" FOREIGN KEY ("tenant_id", "catalog_id") REFERENCES "hsn_sac_catalog"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_rate_rules" ADD CONSTRAINT "gst_rate_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_rate_rules" ADD CONSTRAINT "gst_rate_rules_tenant_id_hsn_sac_catalog_id_fkey" FOREIGN KEY ("tenant_id", "hsn_sac_catalog_id") REFERENCES "hsn_sac_catalog"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_rate_rules" ADD CONSTRAINT "gst_rate_rules_tenant_id_approved_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "approved_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_rate_rule_history" ADD CONSTRAINT "gst_rate_rule_history_tenant_id_rule_id_fkey" FOREIGN KEY ("tenant_id", "rule_id") REFERENCES "gst_rate_rules"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_purchase_fkey" FOREIGN KEY ("tenant_id", "purchase_id") REFERENCES "purchase_invoices"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_line_acceptance_actor_fkey" FOREIGN KEY ("tenant_id", "accepted_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_line_acceptance_decision_fkey" FOREIGN KEY ("tenant_id", "purchase_id", "accepted_decision_id") REFERENCES "purchase_gst_accounting_decisions"("tenant_id", "purchase_invoice_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_valuation_decisions" ADD CONSTRAINT "inventory_valuation_decisions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_valuation_decisions" ADD CONSTRAINT "inventory_valuation_decisions_purchase_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id") REFERENCES "purchase_invoices"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_valuation_decisions" ADD CONSTRAINT "inventory_valuation_decisions_purchase_item_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id", "purchase_invoice_item_id") REFERENCES "purchase_invoice_items"("tenant_id", "purchase_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_valuation_decisions" ADD CONSTRAINT "inventory_valuation_decisions_batch_fkey" FOREIGN KEY ("tenant_id", "product_batch_id") REFERENCES "product_batches"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_valuation_decisions" ADD CONSTRAINT "inventory_valuation_decisions_movement_fkey" FOREIGN KEY ("tenant_id", "stock_movement_id") REFERENCES "stock_movements"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_valuation_decisions" ADD CONSTRAINT "inventory_valuation_decisions_tenant_id_decided_by_members_fkey" FOREIGN KEY ("tenant_id", "decided_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_valuation_decisions" ADD CONSTRAINT "inventory_valuation_decisions_tenant_id_supersedes_decisio_fkey" FOREIGN KEY ("tenant_id", "supersedes_decision_id") REFERENCES "inventory_valuation_decisions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_valuation_adjustments" ADD CONSTRAINT "inventory_valuation_adjustments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_valuation_adjustments" ADD CONSTRAINT "inventory_valuation_adjustments_tenant_id_prior_decision_i_fkey" FOREIGN KEY ("tenant_id", "prior_decision_id") REFERENCES "inventory_valuation_decisions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_valuation_adjustments" ADD CONSTRAINT "inventory_valuation_adjustments_tenant_id_resulting_decisi_fkey" FOREIGN KEY ("tenant_id", "resulting_decision_id") REFERENCES "inventory_valuation_decisions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_valuation_adjustments" ADD CONSTRAINT "inventory_valuation_adjustments_tenant_id_adjusted_by_memb_fkey" FOREIGN KEY ("tenant_id", "adjusted_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_gst_evidence_revisions" ADD CONSTRAINT "purchase_gst_evidence_purchase_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id") REFERENCES "purchase_invoices"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_gst_evidence_revisions" ADD CONSTRAINT "purchase_gst_evidence_supersedes_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id", "supersedes_revision_id") REFERENCES "purchase_gst_evidence_revisions"("tenant_id", "purchase_invoice_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_gst_evidence_revisions" ADD CONSTRAINT "purchase_gst_evidence_capture_actor_fkey" FOREIGN KEY ("tenant_id", "captured_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_gst_line_evidence" ADD CONSTRAINT "purchase_gst_line_evidence_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_gst_line_evidence" ADD CONSTRAINT "purchase_gst_line_evidence_revision_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id", "evidence_revision_id") REFERENCES "purchase_gst_evidence_revisions"("tenant_id", "purchase_invoice_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_gst_line_evidence" ADD CONSTRAINT "purchase_gst_line_evidence_item_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id", "purchase_invoice_item_id") REFERENCES "purchase_invoice_items"("tenant_id", "purchase_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_gst_calculations" ADD CONSTRAINT "purchase_gst_calculation_purchase_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id") REFERENCES "purchase_invoices"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_gst_calculations" ADD CONSTRAINT "purchase_gst_calculation_revision_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id", "evidence_revision_id") REFERENCES "purchase_gst_evidence_revisions"("tenant_id", "purchase_invoice_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_gst_accounting_decisions" ADD CONSTRAINT "purchase_gst_decision_purchase_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id") REFERENCES "purchase_invoices"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_gst_accounting_decisions" ADD CONSTRAINT "purchase_gst_decision_revision_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id", "evidence_revision_id") REFERENCES "purchase_gst_evidence_revisions"("tenant_id", "purchase_invoice_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_gst_accounting_decisions" ADD CONSTRAINT "purchase_gst_decision_actor_fkey" FOREIGN KEY ("tenant_id", "decided_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_gst_accounting_decisions" ADD CONSTRAINT "purchase_gst_decision_calculation_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id", "calculation_id") REFERENCES "purchase_gst_calculations"("tenant_id", "purchase_invoice_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_gst_reconciliation_events" ADD CONSTRAINT "purchase_gst_reconciliation_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_gst_reconciliation_events" ADD CONSTRAINT "purchase_gst_event_purchase_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id") REFERENCES "purchase_invoices"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_gst_reconciliation_events" ADD CONSTRAINT "purchase_gst_event_revision_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id", "evidence_revision_id") REFERENCES "purchase_gst_evidence_revisions"("tenant_id", "purchase_invoice_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_gst_reconciliation_events" ADD CONSTRAINT "purchase_gst_event_actor_fkey" FOREIGN KEY ("tenant_id", "actor_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_gst_reconciliation_event_lines" ADD CONSTRAINT "purchase_gst_event_line_event_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id", "evidence_revision_id", "event_id") REFERENCES "purchase_gst_reconciliation_events"("tenant_id", "purchase_invoice_id", "evidence_revision_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_gst_reconciliation_event_lines" ADD CONSTRAINT "purchase_gst_event_line_evidence_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id", "evidence_revision_id", "line_evidence_id") REFERENCES "purchase_gst_line_evidence"("tenant_id", "purchase_invoice_id", "evidence_revision_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_posting_operations" ADD CONSTRAINT "sales_posting_operations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_posting_operations" ADD CONSTRAINT "sales_posting_operations_tenant_id_sales_invoice_id_fkey" FOREIGN KEY ("tenant_id", "sales_invoice_id") REFERENCES "sales_invoices"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_customer_fkey" FOREIGN KEY ("tenant_id", "customer_id") REFERENCES "customers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_supplier_fkey" FOREIGN KEY ("tenant_id", "supplier_id") REFERENCES "suppliers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipt_sequences" ADD CONSTRAINT "payment_receipt_sequences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_tenant_id_payment_id_fkey" FOREIGN KEY ("tenant_id", "payment_id") REFERENCES "payments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_tenant_id_sales_invoice_id_fkey" FOREIGN KEY ("tenant_id", "sales_invoice_id") REFERENCES "sales_invoices"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_tenant_id_purchase_invoice_id_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id") REFERENCES "purchase_invoices"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_reversals" ADD CONSTRAINT "allocation_reversals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_reversals" ADD CONSTRAINT "allocation_reversals_tenant_id_allocation_id_fkey" FOREIGN KEY ("tenant_id", "allocation_id") REFERENCES "payment_allocations"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_tenant_id_payment_id_fkey" FOREIGN KEY ("tenant_id", "payment_id") REFERENCES "payments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reversals" ADD CONSTRAINT "payment_reversals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reversals" ADD CONSTRAINT "payment_reversals_tenant_id_payment_id_fkey" FOREIGN KEY ("tenant_id", "payment_id") REFERENCES "payments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- HSN/SAC governance integrity controls. These are part of the executable
-- baseline so a fresh disposable database does not depend on a later migration.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "hsn_sac_catalog"
  ADD CONSTRAINT "hsn_sac_catalog_effective_range_check"
  CHECK ("effective_to" IS NULL OR "effective_from" IS NULL OR "effective_to" > "effective_from");

ALTER TABLE "hsn_sac_catalog"
  ADD CONSTRAINT "hsn_sac_catalog_approval_state_check"
  CHECK (
    "classification_status" <> 'APPROVED'::"GstApprovalStatus"
    OR (
      "is_active" = true
      AND "classification_approved_by_membership_id" IS NOT NULL
      AND "classification_approved_at" IS NOT NULL
    )
  );

ALTER TABLE "gst_rate_rules"
  ADD CONSTRAINT "gst_rate_rules_tax_rate_check"
  CHECK ("tax_rate" IS NULL OR ("tax_rate" = "tax_rate" AND "tax_rate" >= 0));

ALTER TABLE "gst_rate_rules"
  ADD CONSTRAINT "gst_rate_rules_effective_range_check"
  CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from");

ALTER TABLE "gst_rate_rules"
  ADD CONSTRAINT "gst_rate_rules_approval_state_check"
  CHECK (
    "approval_status" <> 'APPROVED'::"GstApprovalStatus"
    OR (
      "is_active" = true
      AND "approved_by_membership_id" IS NOT NULL
      AND "approved_at" IS NOT NULL
    )
  );

CREATE OR REPLACE FUNCTION "prevent_hsn_governance_history_mutation"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RAISE EXCEPTION 'HSN/SAC governance history is immutable: %', TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$function$;

CREATE TRIGGER "prevent_hsn_sac_catalog_history_mutation"
  BEFORE UPDATE OR DELETE ON "hsn_sac_catalog_history"
  FOR EACH ROW EXECUTE FUNCTION "prevent_hsn_governance_history_mutation"();

CREATE TRIGGER "prevent_gst_rate_rule_history_mutation"
  BEFORE UPDATE OR DELETE ON "gst_rate_rule_history"
  FOR EACH ROW EXECUTE FUNCTION "prevent_hsn_governance_history_mutation"();

CREATE OR REPLACE FUNCTION "prevent_approved_gst_rule_mutation"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF OLD."approval_status" = 'APPROVED'::"GstApprovalStatus" THEN
    RAISE EXCEPTION 'Approved GST rate rules are immutable; create a pending revision'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER "prevent_approved_gst_rule_mutation"
  BEFORE UPDATE ON "gst_rate_rules"
  FOR EACH ROW EXECUTE FUNCTION "prevent_approved_gst_rule_mutation"();

ALTER TABLE "gst_rate_rules"
  ADD CONSTRAINT "gst_rate_rules_approved_period_excl"
  EXCLUDE USING gist (
    "tenant_id" WITH =,
    (COALESCE("hsn_sac_catalog_id", '')) WITH =,
    "component_policy" WITH =,
    tsrange("effective_from", COALESCE("effective_to", 'infinity'::timestamp), '[)') WITH &&
  )
  WHERE ("approval_status" = 'APPROVED'::"GstApprovalStatus" AND "is_active" = true);

REVOKE UPDATE, DELETE ON TABLE "hsn_sac_catalog_history", "gst_rate_rule_history" FROM PUBLIC;

DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pharmnos_e2e_runtime') THEN
    EXECUTE 'GRANT SELECT, INSERT ON TABLE "hsn_sac_catalog_history", "gst_rate_rule_history" TO "pharmnos_e2e_runtime"';
    EXECUTE 'REVOKE UPDATE, DELETE ON TABLE "hsn_sac_catalog_history", "gst_rate_rule_history" FROM "pharmnos_e2e_runtime"';
  END IF;
END;
$grant$;

ALTER TABLE "payments" ADD CONSTRAINT "payments_one_counterparty_check" CHECK (("customer_id" IS NOT NULL)::int + ("supplier_id" IS NOT NULL)::int = 1);

ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_approved_actor_pair_check" CHECK (("approved_at" IS NULL) = ("approved_by" IS NULL));

ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_rejected_actor_pair_check" CHECK (("rejected_at" IS NULL) = ("rejected_by" IS NULL));

ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_cancelled_actor_pair_check" CHECK (("cancelled_at" IS NULL) = ("cancelled_by" IS NULL));

CREATE UNIQUE INDEX IF NOT EXISTS "audit_logs_refund_lifecycle_idempotency_key"
  ON "audit_logs" ("tenant_id", (("metadata" ->> 'idempotencyKey')))
  WHERE "target_type" = 'payment_refund'
    AND "metadata" ->> 'refundLifecycleVersion' = '1';

CREATE OR REPLACE FUNCTION public.guard_payment_refund_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status::text <> 'REQUESTED'
       OR NEW.approved_at IS NOT NULL
       OR NEW.rejected_at IS NOT NULL
       OR NEW.completed_at IS NOT NULL
       OR NEW.cancelled_at IS NOT NULL
       OR NEW.approved_by IS NOT NULL
       OR NEW.rejected_by IS NOT NULL
       OR NEW.completed_by IS NOT NULL
       OR NEW.cancelled_by IS NOT NULL
       OR NEW.requested_by IS NULL
       OR NEW.resolution_reason IS NOT NULL THEN
      RAISE EXCEPTION 'Refunds must be created as REQUESTED'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.request_payload_hash IS DISTINCT FROM OLD.request_payload_hash
     OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
     OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
     OR NEW.reason IS DISTINCT FROM OLD.reason THEN
    RAISE EXCEPTION 'Refund request facts are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.status::text = 'REQUESTED'
     AND NEW.status::text = 'APPROVED'
     AND NEW.approved_by IS NOT NULL
     AND NEW.approved_at IS NOT NULL
     AND NEW.rejected_at IS NULL
     AND NEW.completed_at IS NULL
     AND NEW.cancelled_at IS NULL
     AND NEW.rejected_by IS NULL
     AND NEW.completed_by IS NULL
     AND NEW.cancelled_by IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status::text = 'REQUESTED'
     AND NEW.status::text = 'REJECTED'
     AND NEW.rejected_by IS NOT NULL
     AND NEW.rejected_at IS NOT NULL
     AND NEW.approved_at IS NULL
     AND NEW.completed_at IS NULL
     AND NEW.cancelled_at IS NULL
     AND NEW.approved_by IS NULL
     AND NEW.completed_by IS NULL
     AND NEW.cancelled_by IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status::text = 'REQUESTED'
     AND NEW.status::text = 'CANCELLED'
     AND NEW.cancelled_by IS NOT NULL
     AND NEW.cancelled_at IS NOT NULL
     AND NEW.approved_at IS NULL
     AND NEW.rejected_at IS NULL
     AND NEW.completed_at IS NULL
     AND NEW.approved_by IS NULL
     AND NEW.rejected_by IS NULL
     AND NEW.completed_by IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status::text = 'APPROVED'
     AND NEW.status::text = 'COMPLETED'
     AND NEW.approved_by IS NOT NULL
     AND NEW.approved_at IS NOT NULL
     AND NEW.completed_by IS NOT NULL
     AND NEW.completed_at IS NOT NULL
     AND NEW.rejected_at IS NULL
     AND NEW.cancelled_at IS NULL
     AND NEW.rejected_by IS NULL
     AND NEW.cancelled_by IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status::text = 'APPROVED'
     AND NEW.status::text = 'CANCELLED'
     AND NEW.approved_by IS NOT NULL
     AND NEW.approved_at IS NOT NULL
     AND NEW.cancelled_by IS NOT NULL
     AND NEW.cancelled_at IS NOT NULL
     AND NEW.rejected_at IS NULL
     AND NEW.completed_at IS NULL
     AND NEW.completed_by IS NULL
     AND NEW.rejected_by IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid or immutable refund lifecycle transition: % to %',
    OLD.status, NEW.status
    USING ERRCODE = '23514';
END;
$function$;

CREATE TRIGGER "payment_refunds_lifecycle_guard"
      BEFORE INSERT OR UPDATE ON "payment_refunds"
      FOR EACH ROW
      EXECUTE FUNCTION public.guard_payment_refund_lifecycle();
