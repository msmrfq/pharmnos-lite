CREATE OR REPLACE FUNCTION public.prevent_finalized_purchase_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'purchase_invoices' THEN
    IF OLD.status = 'FINALIZED'::public."InvoiceStatus" THEN
      IF TG_OP = 'UPDATE'
         AND OLD.finalized_at IS NOT NULL
         AND (
           NEW.invoice_no IS DISTINCT FROM OLD.invoice_no
           OR NEW.gross_amount IS DISTINCT FROM OLD.gross_amount
           OR NEW.total_discount IS DISTINCT FROM OLD.total_discount
           OR NEW.total_tax IS DISTINCT FROM OLD.total_tax
           OR NEW.round_off IS DISTINCT FROM OLD.round_off
           OR NEW.net_amount IS DISTINCT FROM OLD.net_amount
           OR NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
           OR NEW.supplier_invoice_no IS DISTINCT FROM OLD.supplier_invoice_no
           OR NEW.invoice_date IS DISTINCT FROM OLD.invoice_date
           OR NEW.gst_treatment IS DISTINCT FROM OLD.gst_treatment
           OR NEW.tax_mode IS DISTINCT FROM OLD.tax_mode
           OR NEW.notes IS DISTINCT FROM OLD.notes
           OR NEW.finalized_snapshot IS DISTINCT FROM OLD.finalized_snapshot
           OR NEW.finalized_snapshot_hash IS DISTINCT FROM OLD.finalized_snapshot_hash
           OR NEW.rendering_version IS DISTINCT FROM OLD.rendering_version
           OR NEW.finalized_at IS DISTINCT FROM OLD.finalized_at
           OR NEW.current_gst_evidence_revision_id IS DISTINCT FROM OLD.current_gst_evidence_revision_id
           OR NEW.current_gst_calculation_id IS DISTINCT FROM OLD.current_gst_calculation_id
           OR NEW.current_gst_accounting_decision_id IS DISTINCT FROM OLD.current_gst_accounting_decision_id
           OR NEW.gst_reconciliation_status IS DISTINCT FROM OLD.gst_reconciliation_status
           OR NEW.gst_accounting_acceptance_status IS DISTINCT FROM OLD.gst_accounting_acceptance_status
           OR NEW.gst_record_version IS DISTINCT FROM OLD.gst_record_version
         )
      THEN
        RAISE EXCEPTION 'Finalized purchase invoice values are immutable'
          USING ERRCODE = '42501';
      END IF;
      -- Finalization uses one status-claim update followed by one controlled
      -- completion update that records accepted totals and invoice number.
      IF TG_OP = 'UPDATE'
         AND OLD.finalized_at IS NULL
         AND NEW.status = 'FINALIZED'::public."InvoiceStatus"
         AND NEW.finalized_at IS NOT NULL
         AND NEW.id IS NOT DISTINCT FROM OLD.id
         AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id
         AND NEW.supplier_id IS NOT DISTINCT FROM OLD.supplier_id
         AND NEW.supplier_invoice_no IS NOT DISTINCT FROM OLD.supplier_invoice_no
         AND NEW.invoice_date IS NOT DISTINCT FROM OLD.invoice_date
         AND NEW.gst_reconciliation_status IS NOT DISTINCT FROM OLD.gst_reconciliation_status
         AND NEW.gst_accounting_acceptance_status IS NOT DISTINCT FROM OLD.gst_accounting_acceptance_status
         AND NEW.gst_treatment IS NOT DISTINCT FROM OLD.gst_treatment
         AND NEW.tax_mode IS NOT DISTINCT FROM OLD.tax_mode
         AND NEW.current_gst_evidence_revision_id IS NOT DISTINCT FROM OLD.current_gst_evidence_revision_id
         AND NEW.current_gst_calculation_id IS NOT DISTINCT FROM OLD.current_gst_calculation_id
         AND NEW.current_gst_accounting_decision_id IS NOT DISTINCT FROM OLD.current_gst_accounting_decision_id
         AND NEW.gst_record_version IS NOT DISTINCT FROM OLD.gst_record_version
         AND NEW.notes IS NOT DISTINCT FROM OLD.notes
         AND NEW.cancelled_at IS NOT DISTINCT FROM OLD.cancelled_at
         AND NEW.cancelled_by IS NOT DISTINCT FROM OLD.cancelled_by
         AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
         AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
      THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Finalized purchase invoice values are immutable'
        USING ERRCODE = '42501';
    END IF;
    -- The application claims finalization in a status-only update before it
    -- writes the accepted totals. Permit only that exact intermediate state;
    -- a direct draft-to-finalized financial update must fail closed.
    IF TG_OP = 'UPDATE'
       AND NEW.status = 'FINALIZED'::public."InvoiceStatus"
       AND NEW.finalized_at IS NULL
       AND NEW.id IS NOT DISTINCT FROM OLD.id
       AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id
       AND NEW.invoice_no IS NOT DISTINCT FROM OLD.invoice_no
       AND NEW.supplier_id IS NOT DISTINCT FROM OLD.supplier_id
       AND NEW.supplier_invoice_no IS NOT DISTINCT FROM OLD.supplier_invoice_no
       AND NEW.invoice_date IS NOT DISTINCT FROM OLD.invoice_date
       AND NEW.gst_reconciliation_status IS NOT DISTINCT FROM OLD.gst_reconciliation_status
       AND NEW.gst_accounting_acceptance_status IS NOT DISTINCT FROM OLD.gst_accounting_acceptance_status
       AND NEW.gst_treatment IS NOT DISTINCT FROM OLD.gst_treatment
       AND NEW.tax_mode IS NOT DISTINCT FROM OLD.tax_mode
       AND NEW.current_gst_evidence_revision_id IS NOT DISTINCT FROM OLD.current_gst_evidence_revision_id
       AND NEW.current_gst_calculation_id IS NOT DISTINCT FROM OLD.current_gst_calculation_id
       AND NEW.current_gst_accounting_decision_id IS NOT DISTINCT FROM OLD.current_gst_accounting_decision_id
       AND NEW.gst_record_version IS NOT DISTINCT FROM OLD.gst_record_version
       AND NEW.gross_amount IS NOT DISTINCT FROM OLD.gross_amount
       AND NEW.total_discount IS NOT DISTINCT FROM OLD.total_discount
       AND NEW.total_tax IS NOT DISTINCT FROM OLD.total_tax
       AND NEW.round_off IS NOT DISTINCT FROM OLD.round_off
       AND NEW.net_amount IS NOT DISTINCT FROM OLD.net_amount
       AND NEW.notes IS NOT DISTINCT FROM OLD.notes
       AND NEW.cancelled_at IS NOT DISTINCT FROM OLD.cancelled_at
       AND NEW.cancelled_by IS NOT DISTINCT FROM OLD.cancelled_by
       AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
       AND NEW.finalized_at IS NOT DISTINCT FROM OLD.finalized_at
       AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
    THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE'
       AND NEW.status = 'FINALIZED'::public."InvoiceStatus"
    THEN
      RAISE EXCEPTION 'Purchase invoice must use the controlled finalization transition'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    DECLARE
      purchase_status public."InvoiceStatus";
      new_purchase_status public."InvoiceStatus";
      purchase_finalized_at timestamp;
    BEGIN
      SELECT status, finalized_at
      INTO purchase_status, purchase_finalized_at
      FROM public."purchase_invoices"
      WHERE id = OLD.purchase_id AND tenant_id = OLD.tenant_id;

      IF purchase_status IS NULL THEN
        RAISE EXCEPTION 'Purchase invoice parent is missing for purchase invoice item'
          USING ERRCODE = '23503';
      END IF;
      new_purchase_status := purchase_status;
      IF TG_OP = 'UPDATE'
         AND (
           NEW.purchase_id IS DISTINCT FROM OLD.purchase_id
           OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
         )
      THEN
        SELECT status
        INTO new_purchase_status
        FROM public."purchase_invoices"
        WHERE id = NEW.purchase_id AND tenant_id = NEW.tenant_id;
        IF new_purchase_status IS NULL THEN
          RAISE EXCEPTION 'Purchase invoice parent is missing for purchase invoice item'
            USING ERRCODE = '23503';
        END IF;
        IF new_purchase_status = 'FINALIZED'::public."InvoiceStatus" THEN
          RAISE EXCEPTION 'Purchase invoice item cannot be moved into finalized history'
            USING ERRCODE = '42501';
        END IF;
      END IF;

      IF purchase_status = 'FINALIZED'::public."InvoiceStatus" THEN
        -- Accepted GST, tax, and invoice amounts are immutable. Valuation
        -- decision denormalizations remain separately governed.
        IF TG_OP = 'UPDATE'
           AND NEW.id IS NOT DISTINCT FROM OLD.id
           AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id
           AND NEW.purchase_id IS NOT DISTINCT FROM OLD.purchase_id
           AND NEW.product_id IS NOT DISTINCT FROM OLD.product_id
           AND NEW.batch_no IS NOT DISTINCT FROM OLD.batch_no
           AND NEW.expiry_date IS NOT DISTINCT FROM OLD.expiry_date
           AND NEW.quantity IS NOT DISTINCT FROM OLD.quantity
           AND NEW.free_qty IS NOT DISTINCT FROM OLD.free_qty
           AND NEW.purchase_rate IS NOT DISTINCT FROM OLD.purchase_rate
           AND NEW.discount_pct IS NOT DISTINCT FROM OLD.discount_pct
           AND NEW.discount_amount IS NOT DISTINCT FROM OLD.discount_amount
           AND NEW.hsn_code_snapshot IS NOT DISTINCT FROM OLD.hsn_code_snapshot
           AND NEW.calculated_taxable_value IS NOT DISTINCT FROM OLD.calculated_taxable_value
           AND NEW.calculated_cgst IS NOT DISTINCT FROM OLD.calculated_cgst
           AND NEW.calculated_sgst IS NOT DISTINCT FROM OLD.calculated_sgst
           AND NEW.calculated_igst IS NOT DISTINCT FROM OLD.calculated_igst
           AND NEW.calculated_cess IS NOT DISTINCT FROM OLD.calculated_cess
           AND NEW.accepted_taxable_value IS NOT DISTINCT FROM OLD.accepted_taxable_value
           AND NEW.accepted_cgst IS NOT DISTINCT FROM OLD.accepted_cgst
           AND NEW.accepted_sgst IS NOT DISTINCT FROM OLD.accepted_sgst
           AND NEW.accepted_igst IS NOT DISTINCT FROM OLD.accepted_igst
           AND NEW.accepted_cess IS NOT DISTINCT FROM OLD.accepted_cess
           AND NEW.accepted_line_total IS NOT DISTINCT FROM OLD.accepted_line_total
           AND NEW.accepted_value_source IS NOT DISTINCT FROM OLD.accepted_value_source
           AND NEW.accepted_reason IS NOT DISTINCT FROM OLD.accepted_reason
           AND NEW.accepted_at IS NOT DISTINCT FROM OLD.accepted_at
           AND NEW.accepted_by_membership_id IS NOT DISTINCT FROM OLD.accepted_by_membership_id
           AND NEW.accepted_decision_id IS NOT DISTINCT FROM OLD.accepted_decision_id
           AND NEW.gst_acceptance_status IS NOT DISTINCT FROM OLD.gst_acceptance_status
           AND NEW.gst_discrepancy_details IS NOT DISTINCT FROM OLD.gst_discrepancy_details
           AND NEW.gst_acceptance_reference IS NOT DISTINCT FROM OLD.gst_acceptance_reference
           AND NEW.mrp IS NOT DISTINCT FROM OLD.mrp
           AND NEW.sale_rate IS NOT DISTINCT FROM OLD.sale_rate
           AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
           AND NEW.gst_amount IS NOT DISTINCT FROM round(
             COALESCE(NEW.accepted_cgst, 0)
             + COALESCE(NEW.accepted_sgst, 0)
             + COALESCE(NEW.accepted_igst, 0)
             + COALESCE(NEW.accepted_cess, 0),
             2
           )
           AND NEW.line_total IS NOT DISTINCT FROM round(NEW.accepted_line_total, 2)
           AND (
             purchase_finalized_at IS NULL
             OR (
               NEW.gst_rate IS NOT DISTINCT FROM OLD.gst_rate
               AND NEW.hsn_sac_catalog_id_snapshot IS NOT DISTINCT FROM OLD.hsn_sac_catalog_id_snapshot
               AND NEW.gst_rule_version_snapshot IS NOT DISTINCT FROM OLD.gst_rule_version_snapshot
               AND NEW.gst_rule_source_reference_snapshot IS NOT DISTINCT FROM OLD.gst_rule_source_reference_snapshot
               AND NEW.gst_calculation_reference IS NOT DISTINCT FROM OLD.gst_calculation_reference
             )
           )
        THEN
          RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Finalized purchase invoice lines and accepted GST values are immutable'
          USING ERRCODE = '42501';
      END IF;
    END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_finalized_purchase_mutation ON public."purchase_invoices";
CREATE TRIGGER prevent_finalized_purchase_mutation
BEFORE UPDATE OR DELETE ON public."purchase_invoices"
FOR EACH ROW EXECUTE FUNCTION public.prevent_finalized_purchase_mutation();

DROP TRIGGER IF EXISTS prevent_finalized_purchase_item_mutation ON public."purchase_invoice_items";
CREATE TRIGGER prevent_finalized_purchase_item_mutation
BEFORE UPDATE OR DELETE ON public."purchase_invoice_items"
FOR EACH ROW EXECUTE FUNCTION public.prevent_finalized_purchase_mutation();

REVOKE EXECUTE ON FUNCTION public.prevent_finalized_purchase_mutation() FROM PUBLIC;
