-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PermissionAction" ADD VALUE 'create_gst_note_draft';
ALTER TYPE "PermissionAction" ADD VALUE 'edit_gst_note_draft';
ALTER TYPE "PermissionAction" ADD VALUE 'view_gst_note';
ALTER TYPE "PermissionAction" ADD VALUE 'receive_gst_note';
ALTER TYPE "PermissionAction" ADD VALUE 'review_gst_note';
ALTER TYPE "PermissionAction" ADD VALUE 'approve_gst_note';
ALTER TYPE "PermissionAction" ADD VALUE 'issue_gst_note';
ALTER TYPE "PermissionAction" ADD VALUE 'amend_gst_note';
ALTER TYPE "PermissionAction" ADD VALUE 'cancel_gst_note';
ALTER TYPE "PermissionAction" ADD VALUE 'post_gst_note_accounting';
ALTER TYPE "PermissionAction" ADD VALUE 'review_recipient_itc';
ALTER TYPE "PermissionAction" ADD VALUE 'record_recipient_itc_reversal';
ALTER TYPE "PermissionAction" ADD VALUE 'approve_supplier_output_tax_adjustment';
ALTER TYPE "PermissionAction" ADD VALUE 'authorize_gst_note_return';
ALTER TYPE "PermissionAction" ADD VALUE 'receive_gst_note_return';
ALTER TYPE "PermissionAction" ADD VALUE 'inspect_gst_note_return';
ALTER TYPE "PermissionAction" ADD VALUE 'post_gst_note_stock';
ALTER TYPE "PermissionAction" ADD VALUE 'prepare_gst_note_reporting';
ALTER TYPE "PermissionAction" ADD VALUE 'record_gst_note_return_evidence';
ALTER TYPE "PermissionAction" ADD VALUE 'review_gst_note_reporting_discrepancy';
ALTER TYPE "PermissionAction" ADD VALUE 'record_gst_note_irp_evidence';
ALTER TYPE "PermissionAction" ADD VALUE 'submit_gst_note_reporting';
ALTER TYPE "PermissionAction" ADD VALUE 'retry_gst_note_reporting';
ALTER TYPE "PermissionAction" ADD VALUE 'reconcile_gst_note_reporting';
ALTER TYPE "PermissionAction" ADD VALUE 'submit_gst_note_irp';
ALTER TYPE "PermissionAction" ADD VALUE 'retry_gst_note_irp';
ALTER TYPE "PermissionAction" ADD VALUE 'reconcile_gst_note_irp';
ALTER TYPE "PermissionAction" ADD VALUE 'view_gst_note_compliance';
ALTER TYPE "PermissionAction" ADD VALUE 'manage_gst_note_configuration';

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'GST_NOTE_EVENT';

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "note_event_id" TEXT;

-- CreateTable
CREATE TABLE "gst_adjustment_notes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "document_class" TEXT NOT NULL DEFAULT 'STATUTORY_GST',
    "direction" TEXT NOT NULL,
    "source_class" TEXT NOT NULL,
    "note_type" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "note_number" TEXT,
    "financial_year" TEXT,
    "issue_date" TIMESTAMP(3),
    "reporting_period" TEXT,
    "issuer_customer_id" TEXT,
    "recipient_customer_id" TEXT,
    "issuer_supplier_id" TEXT,
    "recipient_supplier_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "communication_status" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "return_reporting_status" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "irp_status" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "irn_status" TEXT NOT NULL DEFAULT 'NOT_GENERATED',
    "accounting_status" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "settlement_status" TEXT NOT NULL DEFAULT 'OPEN',
    "section34_declaration_window_status" TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
    "current_output_tax_review_id" TEXT,
    "current_itc_review_id" TEXT,
    "calculation_version" TEXT,
    "rounding_version" TEXT,
    "rounding_mode" TEXT,
    "calculation_scale" INTEGER,
    "tax_component_scale" INTEGER,
    "taxable_value" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "cgst" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "utgst" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "igst" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "cess" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "gross_effect" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3),
    "issuer_snapshot" JSONB,
    "recipient_snapshot" JSONB,
    "source_snapshot" JSONB,
    "tax_snapshot" JSONB,
    "request_payload_hash" TEXT,
    "idempotency_key" TEXT,
    "metadata" JSONB,
    "created_by_membership_id" TEXT,
    "issued_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gst_adjustment_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_adjustment_note_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "source_class" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name_snapshot" TEXT,
    "generic_name_snapshot" TEXT,
    "hsn_sac_snapshot" TEXT,
    "batch_no_snapshot" TEXT,
    "quantity" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "unit_value" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "taxable_value" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "cgst" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "utgst" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "igst" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "cess" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "gross_effect" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "calculation_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_adjustment_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_adjustment_note_source_documents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "source_class" TEXT NOT NULL,
    "source_kind" TEXT NOT NULL,
    "sales_invoice_id" TEXT,
    "purchase_invoice_id" TEXT,
    "original_number" TEXT NOT NULL,
    "original_date" TIMESTAMP(3) NOT NULL,
    "source_status" TEXT NOT NULL,
    "source_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_adjustment_note_source_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_adjustment_note_source_allocations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "note_line_id" TEXT NOT NULL,
    "source_document_id" TEXT NOT NULL,
    "source_class" TEXT NOT NULL,
    "sales_invoice_id" TEXT,
    "sales_invoice_item_id" TEXT,
    "purchase_invoice_id" TEXT,
    "purchase_invoice_item_id" TEXT,
    "allocation_basis" TEXT NOT NULL,
    "basis_evidence" JSONB,
    "quantity" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "taxable_value" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "cgst" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "utgst" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "igst" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "cess" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "gross_effect" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "remaining_before" JSONB,
    "remaining_after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_adjustment_note_source_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_note_posting_operations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "operation_type" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_payload_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "result_reference" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gst_note_posting_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_note_posting_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "account_code" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "tax_head" TEXT,
    "amount" DECIMAL(20,4) NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_note_posting_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_adjustment_note_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "sequence_no" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "state_dimension" TEXT NOT NULL,
    "from_state" TEXT,
    "to_state" TEXT,
    "actor_membership_id" TEXT,
    "idempotency_key" TEXT,
    "payload_hash" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_adjustment_note_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_adjustments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note_id" TEXT,
    "source_class" TEXT NOT NULL,
    "adjustment_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(20,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "idempotency_key" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commercial_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_note_number_series" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "source_class" TEXT NOT NULL,
    "note_type" TEXT NOT NULL,
    "financial_year" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "next_sequence" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gst_note_number_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_note_configuration_versions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "calculation_version" TEXT,
    "rounding_version" TEXT,
    "configuration" JSONB NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_note_configuration_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_adjustment_note_output_tax_reviews" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "revision_no" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "legal_basis" TEXT,
    "deadline" TIMESTAMP(3),
    "incidence_passed" BOOLEAN,
    "itc_availed_status" TEXT,
    "declaration_status" TEXT,
    "evidence" JSONB,
    "decision_reason" TEXT,
    "reviewed_by_membership_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_adjustment_note_output_tax_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_adjustment_note_itc_reviews" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "revision_no" INTEGER NOT NULL,
    "revision_state" TEXT NOT NULL DEFAULT 'CURRENT',
    "progress_state" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "eligibility_state" TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
    "outcome_state" TEXT NOT NULL DEFAULT 'PENDING',
    "legal_state" TEXT NOT NULL DEFAULT 'LEGAL_CONFIRMATION_PENDING',
    "supersedes_review_id" TEXT,
    "evidence" JSONB,
    "decision_reason" TEXT,
    "reviewed_by_membership_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_adjustment_note_itc_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_adjustment_note_itc_allocations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "itc_review_id" TEXT NOT NULL,
    "source_document_id" TEXT NOT NULL,
    "purchase_invoice_id" TEXT NOT NULL,
    "purchase_invoice_item_id" TEXT NOT NULL,
    "tax_head" TEXT NOT NULL,
    "amount_availed" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "amount_reversed" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "amount_claimed" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "outcome_state" TEXT NOT NULL,
    "evidence" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_adjustment_note_itc_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "physical_returns" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note_id" TEXT,
    "source_class" TEXT NOT NULL,
    "source_document_id" TEXT,
    "source_line_id" TEXT,
    "product_id" TEXT,
    "batch_id" TEXT,
    "requested_quantity" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "accepted_quantity" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "inspection_outcome" TEXT,
    "valuation_status" TEXT NOT NULL DEFAULT 'PENDING',
    "evidence" JSONB,
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "physical_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "physical_return_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "physical_return_id" TEXT NOT NULL,
    "sequence_no" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "from_state" TEXT,
    "to_state" TEXT NOT NULL,
    "accepted_quantity" DECIMAL(20,4),
    "evidence" JSONB,
    "actor_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "physical_return_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_adjustment_note_return_links" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "physical_return_id" TEXT NOT NULL,
    "stock_movement_id" TEXT,
    "accepted_quantity" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "valuation_policy_version" TEXT,
    "posting_status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_adjustment_note_return_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_adjustment_note_reporting_attempts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MANUAL_EVIDENCE',
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reporting_period" TEXT NOT NULL,
    "original_reference" TEXT,
    "external_reference" TEXT,
    "filing_date" TIMESTAMP(3),
    "evidence_source" TEXT,
    "attempt_no" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "response" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_adjustment_note_reporting_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_adjustment_note_irp_attempts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "applicability" TEXT NOT NULL,
    "rule_version" TEXT,
    "document_type" TEXT,
    "endpoint" TEXT,
    "attempt_no" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "irn" TEXT,
    "acknowledgement" JSONB,
    "cancellation_state" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_adjustment_note_irp_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gst_adjustment_notes_tenant_id_status_created_at_idx" ON "gst_adjustment_notes"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "gst_adjustment_notes_tenant_id_source_class_direction_idx" ON "gst_adjustment_notes"("tenant_id", "source_class", "direction");

-- CreateIndex
CREATE INDEX "gst_adjustment_notes_tenant_id_current_output_tax_review_id_idx" ON "gst_adjustment_notes"("tenant_id", "current_output_tax_review_id");

-- CreateIndex
CREATE INDEX "gst_adjustment_notes_tenant_id_current_itc_review_id_idx" ON "gst_adjustment_notes"("tenant_id", "current_itc_review_id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_notes_tenant_id_id_key" ON "gst_adjustment_notes"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_notes_tenant_id_note_number_financial_year_key" ON "gst_adjustment_notes"("tenant_id", "note_number", "financial_year");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_notes_tenant_id_idempotency_key_key" ON "gst_adjustment_notes"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "gst_adjustment_note_lines_tenant_id_note_id_line_number_idx" ON "gst_adjustment_note_lines"("tenant_id", "note_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_lines_tenant_id_note_id_id_key" ON "gst_adjustment_note_lines"("tenant_id", "note_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_lines_tenant_id_note_id_line_number_key" ON "gst_adjustment_note_lines"("tenant_id", "note_id", "line_number");

-- CreateIndex
CREATE INDEX "gst_adjustment_note_source_documents_tenant_id_sales_invoic_idx" ON "gst_adjustment_note_source_documents"("tenant_id", "sales_invoice_id");

-- CreateIndex
CREATE INDEX "gst_adjustment_note_source_documents_tenant_id_purchase_inv_idx" ON "gst_adjustment_note_source_documents"("tenant_id", "purchase_invoice_id");

-- CreateIndex
CREATE INDEX "gst_adjustment_note_source_documents_tenant_id_note_id_idx" ON "gst_adjustment_note_source_documents"("tenant_id", "note_id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_source_documents_tenant_id_id_key" ON "gst_adjustment_note_source_documents"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_source_documents_tenant_id_note_id_sour_key" ON "gst_adjustment_note_source_documents"("tenant_id", "note_id", "source_kind", "sales_invoice_id", "purchase_invoice_id");

-- CreateIndex
CREATE INDEX "gst_adjustment_note_source_allocations_tenant_id_source_doc_idx" ON "gst_adjustment_note_source_allocations"("tenant_id", "source_document_id");

-- CreateIndex
CREATE INDEX "gst_adjustment_note_source_allocations_tenant_id_sales_invo_idx" ON "gst_adjustment_note_source_allocations"("tenant_id", "sales_invoice_id", "sales_invoice_item_id");

-- CreateIndex
CREATE INDEX "gst_adjustment_note_source_allocations_tenant_id_purchase_i_idx" ON "gst_adjustment_note_source_allocations"("tenant_id", "purchase_invoice_id", "purchase_invoice_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_source_allocations_tenant_id_id_key" ON "gst_adjustment_note_source_allocations"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_source_allocations_tenant_id_note_id_sa_key" ON "gst_adjustment_note_source_allocations"("tenant_id", "note_id", "sales_invoice_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_source_allocations_tenant_id_note_id_pu_key" ON "gst_adjustment_note_source_allocations"("tenant_id", "note_id", "purchase_invoice_item_id");

-- CreateIndex
CREATE INDEX "gst_note_posting_operations_tenant_id_note_id_status_idx" ON "gst_note_posting_operations"("tenant_id", "note_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "gst_note_posting_operations_tenant_id_id_key" ON "gst_note_posting_operations"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_note_posting_operations_tenant_id_operation_type_idempo_key" ON "gst_note_posting_operations"("tenant_id", "operation_type", "idempotency_key");

-- CreateIndex
CREATE INDEX "gst_note_posting_lines_tenant_id_operation_id_idx" ON "gst_note_posting_lines"("tenant_id", "operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_note_posting_lines_tenant_id_id_key" ON "gst_note_posting_lines"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_note_posting_lines_tenant_id_operation_id_line_number_key" ON "gst_note_posting_lines"("tenant_id", "operation_id", "line_number");

-- CreateIndex
CREATE INDEX "gst_adjustment_note_events_tenant_id_note_id_created_at_idx" ON "gst_adjustment_note_events"("tenant_id", "note_id", "created_at");

-- CreateIndex
CREATE INDEX "gst_adjustment_note_events_tenant_id_actor_membership_id_idx" ON "gst_adjustment_note_events"("tenant_id", "actor_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_events_tenant_id_id_key" ON "gst_adjustment_note_events"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_events_tenant_id_note_id_sequence_no_key" ON "gst_adjustment_note_events"("tenant_id", "note_id", "sequence_no");

-- CreateIndex
CREATE INDEX "commercial_adjustments_tenant_id_note_id_idx" ON "commercial_adjustments"("tenant_id", "note_id");

-- CreateIndex
CREATE INDEX "commercial_adjustments_tenant_id_status_idx" ON "commercial_adjustments"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "commercial_adjustments_tenant_id_id_key" ON "commercial_adjustments"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "commercial_adjustments_tenant_id_idempotency_key_key" ON "commercial_adjustments"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "gst_note_number_series_tenant_id_is_active_idx" ON "gst_note_number_series"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "gst_note_number_series_tenant_id_id_key" ON "gst_note_number_series"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_note_number_series_tenant_id_direction_source_class_not_key" ON "gst_note_number_series"("tenant_id", "direction", "source_class", "note_type", "financial_year");

-- CreateIndex
CREATE INDEX "gst_note_configuration_versions_tenant_id_effective_from_ef_idx" ON "gst_note_configuration_versions"("tenant_id", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "gst_note_configuration_versions_tenant_id_id_key" ON "gst_note_configuration_versions"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_note_configuration_versions_tenant_id_version_key" ON "gst_note_configuration_versions"("tenant_id", "version");

-- CreateIndex
CREATE INDEX "gst_adjustment_note_output_tax_reviews_tenant_id_note_id_st_idx" ON "gst_adjustment_note_output_tax_reviews"("tenant_id", "note_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_output_tax_reviews_tenant_id_id_key" ON "gst_adjustment_note_output_tax_reviews"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_output_tax_reviews_tenant_id_note_id_re_key" ON "gst_adjustment_note_output_tax_reviews"("tenant_id", "note_id", "revision_no");

-- CreateIndex
CREATE INDEX "gst_adjustment_note_itc_reviews_tenant_id_note_id_revision__idx" ON "gst_adjustment_note_itc_reviews"("tenant_id", "note_id", "revision_state");

-- CreateIndex
CREATE INDEX "gst_adjustment_note_itc_reviews_tenant_id_outcome_state_idx" ON "gst_adjustment_note_itc_reviews"("tenant_id", "outcome_state");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_itc_reviews_tenant_id_id_key" ON "gst_adjustment_note_itc_reviews"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_itc_reviews_tenant_id_note_id_revision__key" ON "gst_adjustment_note_itc_reviews"("tenant_id", "note_id", "revision_no");

-- CreateIndex
CREATE INDEX "gst_adjustment_note_itc_allocations_tenant_id_source_docume_idx" ON "gst_adjustment_note_itc_allocations"("tenant_id", "source_document_id", "purchase_invoice_item_id", "tax_head");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_itc_allocations_tenant_id_id_key" ON "gst_adjustment_note_itc_allocations"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_itc_allocations_tenant_id_itc_review_id_key" ON "gst_adjustment_note_itc_allocations"("tenant_id", "itc_review_id", "source_document_id", "purchase_invoice_item_id", "tax_head");

-- CreateIndex
CREATE INDEX "physical_returns_tenant_id_note_id_status_idx" ON "physical_returns"("tenant_id", "note_id", "status");

-- CreateIndex
CREATE INDEX "physical_returns_tenant_id_source_document_id_source_line_i_idx" ON "physical_returns"("tenant_id", "source_document_id", "source_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "physical_returns_tenant_id_id_key" ON "physical_returns"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "physical_return_events_tenant_id_physical_return_id_created_idx" ON "physical_return_events"("tenant_id", "physical_return_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "physical_return_events_tenant_id_id_key" ON "physical_return_events"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "physical_return_events_tenant_id_physical_return_id_sequenc_key" ON "physical_return_events"("tenant_id", "physical_return_id", "sequence_no");

-- CreateIndex
CREATE INDEX "gst_adjustment_note_return_links_tenant_id_physical_return__idx" ON "gst_adjustment_note_return_links"("tenant_id", "physical_return_id", "posting_status");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_return_links_tenant_id_id_key" ON "gst_adjustment_note_return_links"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_return_links_tenant_id_note_id_physical_key" ON "gst_adjustment_note_return_links"("tenant_id", "note_id", "physical_return_id");

-- CreateIndex
CREATE INDEX "gst_adjustment_note_reporting_attempts_tenant_id_note_id_st_idx" ON "gst_adjustment_note_reporting_attempts"("tenant_id", "note_id", "status");

-- CreateIndex
CREATE INDEX "gst_adjustment_note_reporting_attempts_tenant_id_reporting__idx" ON "gst_adjustment_note_reporting_attempts"("tenant_id", "reporting_period", "category");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_reporting_attempts_tenant_id_id_key" ON "gst_adjustment_note_reporting_attempts"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_reporting_attempts_tenant_id_note_id_pr_key" ON "gst_adjustment_note_reporting_attempts"("tenant_id", "note_id", "provider", "payload_hash");

-- CreateIndex
CREATE INDEX "gst_adjustment_note_irp_attempts_tenant_id_note_id_status_idx" ON "gst_adjustment_note_irp_attempts"("tenant_id", "note_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_irp_attempts_tenant_id_id_key" ON "gst_adjustment_note_irp_attempts"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_irp_attempts_tenant_id_note_id_payload__key" ON "gst_adjustment_note_irp_attempts"("tenant_id", "note_id", "payload_hash");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_id_key" ON "products"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_id_key" ON "customers"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_tenant_id_id_key" ON "suppliers"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoice_items_tenant_id_invoice_id_id_key" ON "sales_invoice_items"("tenant_id", "invoice_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoice_items_tenant_id_id_key" ON "sales_invoice_items"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_note_event_id_idx" ON "audit_logs"("tenant_id", "note_event_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_note_event_id_fkey" FOREIGN KEY ("tenant_id", "note_event_id") REFERENCES "gst_adjustment_note_events"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_notes" ADD CONSTRAINT "gst_adjustment_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_lines" ADD CONSTRAINT "gst_adjustment_note_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_lines" ADD CONSTRAINT "gst_adjustment_note_lines_tenant_id_note_id_fkey" FOREIGN KEY ("tenant_id", "note_id") REFERENCES "gst_adjustment_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_source_documents" ADD CONSTRAINT "gst_adjustment_note_source_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_source_documents" ADD CONSTRAINT "gst_adjustment_note_source_documents_tenant_id_note_id_fkey" FOREIGN KEY ("tenant_id", "note_id") REFERENCES "gst_adjustment_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_source_documents" ADD CONSTRAINT "gst_adjustment_note_source_documents_tenant_id_sales_invoi_fkey" FOREIGN KEY ("tenant_id", "sales_invoice_id") REFERENCES "sales_invoices"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_source_documents" ADD CONSTRAINT "gst_adjustment_note_source_documents_tenant_id_purchase_in_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id") REFERENCES "purchase_invoices"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_source_allocations" ADD CONSTRAINT "gst_adjustment_note_source_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_source_allocations" ADD CONSTRAINT "gst_adjustment_note_source_allocations_tenant_id_note_id_fkey" FOREIGN KEY ("tenant_id", "note_id") REFERENCES "gst_adjustment_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_source_allocations" ADD CONSTRAINT "gst_adjustment_note_source_allocations_tenant_id_note_id_n_fkey" FOREIGN KEY ("tenant_id", "note_id", "note_line_id") REFERENCES "gst_adjustment_note_lines"("tenant_id", "note_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_source_allocations" ADD CONSTRAINT "gst_adjustment_note_source_allocations_tenant_id_source_do_fkey" FOREIGN KEY ("tenant_id", "source_document_id") REFERENCES "gst_adjustment_note_source_documents"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_source_allocations" ADD CONSTRAINT "gst_adjustment_note_source_allocations_tenant_id_sales_inv_fkey" FOREIGN KEY ("tenant_id", "sales_invoice_id", "sales_invoice_item_id") REFERENCES "sales_invoice_items"("tenant_id", "invoice_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_source_allocations" ADD CONSTRAINT "gst_adjustment_note_source_allocations_tenant_id_purchase__fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id", "purchase_invoice_item_id") REFERENCES "purchase_invoice_items"("tenant_id", "purchase_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_note_posting_operations" ADD CONSTRAINT "gst_note_posting_operations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_note_posting_operations" ADD CONSTRAINT "gst_note_posting_operations_tenant_id_note_id_fkey" FOREIGN KEY ("tenant_id", "note_id") REFERENCES "gst_adjustment_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_note_posting_lines" ADD CONSTRAINT "gst_note_posting_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_note_posting_lines" ADD CONSTRAINT "gst_note_posting_lines_tenant_id_operation_id_fkey" FOREIGN KEY ("tenant_id", "operation_id") REFERENCES "gst_note_posting_operations"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_events" ADD CONSTRAINT "gst_adjustment_note_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_events" ADD CONSTRAINT "gst_adjustment_note_events_tenant_id_note_id_fkey" FOREIGN KEY ("tenant_id", "note_id") REFERENCES "gst_adjustment_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_events" ADD CONSTRAINT "gst_adjustment_note_events_tenant_id_actor_membership_id_fkey" FOREIGN KEY ("tenant_id", "actor_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_adjustments" ADD CONSTRAINT "commercial_adjustments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_adjustments" ADD CONSTRAINT "commercial_adjustments_tenant_id_note_id_fkey" FOREIGN KEY ("tenant_id", "note_id") REFERENCES "gst_adjustment_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_note_number_series" ADD CONSTRAINT "gst_note_number_series_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_note_configuration_versions" ADD CONSTRAINT "gst_note_configuration_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_output_tax_reviews" ADD CONSTRAINT "gst_adjustment_note_output_tax_reviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_output_tax_reviews" ADD CONSTRAINT "gst_adjustment_note_output_tax_reviews_tenant_id_note_id_fkey" FOREIGN KEY ("tenant_id", "note_id") REFERENCES "gst_adjustment_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_output_tax_reviews" ADD CONSTRAINT "gst_adjustment_note_output_tax_reviews_tenant_id_reviewed__fkey" FOREIGN KEY ("tenant_id", "reviewed_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_itc_reviews" ADD CONSTRAINT "gst_adjustment_note_itc_reviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_itc_reviews" ADD CONSTRAINT "gst_adjustment_note_itc_reviews_tenant_id_note_id_fkey" FOREIGN KEY ("tenant_id", "note_id") REFERENCES "gst_adjustment_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_itc_reviews" ADD CONSTRAINT "gst_adjustment_note_itc_reviews_tenant_id_reviewed_by_memb_fkey" FOREIGN KEY ("tenant_id", "reviewed_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_itc_reviews" ADD CONSTRAINT "gst_adjustment_note_itc_reviews_tenant_id_supersedes_revie_fkey" FOREIGN KEY ("tenant_id", "supersedes_review_id") REFERENCES "gst_adjustment_note_itc_reviews"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_itc_allocations" ADD CONSTRAINT "gst_adjustment_note_itc_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_itc_allocations" ADD CONSTRAINT "gst_adjustment_note_itc_allocations_tenant_id_itc_review_i_fkey" FOREIGN KEY ("tenant_id", "itc_review_id") REFERENCES "gst_adjustment_note_itc_reviews"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_itc_allocations" ADD CONSTRAINT "gst_adjustment_note_itc_allocations_tenant_id_source_docum_fkey" FOREIGN KEY ("tenant_id", "source_document_id") REFERENCES "gst_adjustment_note_source_documents"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_itc_allocations" ADD CONSTRAINT "gst_adjustment_note_itc_allocations_tenant_id_purchase_inv_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id", "purchase_invoice_item_id") REFERENCES "purchase_invoice_items"("tenant_id", "purchase_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_returns" ADD CONSTRAINT "physical_returns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_returns" ADD CONSTRAINT "physical_returns_tenant_id_note_id_fkey" FOREIGN KEY ("tenant_id", "note_id") REFERENCES "gst_adjustment_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_return_events" ADD CONSTRAINT "physical_return_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_return_events" ADD CONSTRAINT "physical_return_events_tenant_id_physical_return_id_fkey" FOREIGN KEY ("tenant_id", "physical_return_id") REFERENCES "physical_returns"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_return_events" ADD CONSTRAINT "physical_return_events_tenant_id_actor_membership_id_fkey" FOREIGN KEY ("tenant_id", "actor_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_return_links" ADD CONSTRAINT "gst_adjustment_note_return_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_return_links" ADD CONSTRAINT "gst_adjustment_note_return_links_tenant_id_note_id_fkey" FOREIGN KEY ("tenant_id", "note_id") REFERENCES "gst_adjustment_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_return_links" ADD CONSTRAINT "gst_adjustment_note_return_links_tenant_id_physical_return_fkey" FOREIGN KEY ("tenant_id", "physical_return_id") REFERENCES "physical_returns"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_return_links" ADD CONSTRAINT "gst_adjustment_note_return_links_tenant_id_stock_movement__fkey" FOREIGN KEY ("tenant_id", "stock_movement_id") REFERENCES "stock_movements"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_reporting_attempts" ADD CONSTRAINT "gst_adjustment_note_reporting_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_reporting_attempts" ADD CONSTRAINT "gst_adjustment_note_reporting_attempts_tenant_id_note_id_fkey" FOREIGN KEY ("tenant_id", "note_id") REFERENCES "gst_adjustment_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_irp_attempts" ADD CONSTRAINT "gst_adjustment_note_irp_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_adjustment_note_irp_attempts" ADD CONSTRAINT "gst_adjustment_note_irp_attempts_tenant_id_note_id_fkey" FOREIGN KEY ("tenant_id", "note_id") REFERENCES "gst_adjustment_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

