-- Workstream B: finalized sales invoice and item immutability.
--
-- Finalized purchases are already protected by 0015/0021, but finalized sales
-- had no database-level guard: a direct UPDATE or DELETE could alter net totals,
-- GST components, snapshots, or items. This trigger freezes the protected
-- financial/commercial snapshot once an invoice is FINALIZED, while leaving the
-- fields that are legitimately maintained after finalization mutable:
--   paid_amount / balance_due (reconciliation service), pdf_* (async PDF
--   generation), cancelled_* (future cancellation), and the 0028-guarded date
--   columns (effective_date, due_date_business, finalized_recorded_at).
CREATE OR REPLACE FUNCTION public.prevent_finalized_sales_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  parent_status public."InvoiceStatus";
  parent_id text;
BEGIN
  IF TG_TABLE_NAME = 'sales_invoices' THEN
    IF OLD.status = 'FINALIZED'::public."InvoiceStatus" THEN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Finalized sales invoices cannot be deleted'
          USING ERRCODE = '42501';
      END IF;
      IF (
        NEW.status IS DISTINCT FROM OLD.status
        OR NEW.invoice_no IS DISTINCT FROM OLD.invoice_no
        OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
        OR NEW.invoice_date IS DISTINCT FROM OLD.invoice_date
        OR NEW.due_date IS DISTINCT FROM OLD.due_date
        OR NEW.gst_treatment IS DISTINCT FROM OLD.gst_treatment
        OR NEW.tax_mode IS DISTINCT FROM OLD.tax_mode
        OR NEW.place_of_supply_code IS DISTINCT FROM OLD.place_of_supply_code
        OR NEW.is_cash_sale IS DISTINCT FROM OLD.is_cash_sale
        OR NEW.tax_data_status IS DISTINCT FROM OLD.tax_data_status
        OR NEW.payment_mode IS DISTINCT FROM OLD.payment_mode
        OR NEW.gross_amount IS DISTINCT FROM OLD.gross_amount
        OR NEW.total_discount IS DISTINCT FROM OLD.total_discount
        OR NEW.total_tax IS DISTINCT FROM OLD.total_tax
        OR NEW.round_off IS DISTINCT FROM OLD.round_off
        OR NEW.net_amount IS DISTINCT FROM OLD.net_amount
        OR NEW.notes IS DISTINCT FROM OLD.notes
        OR NEW.finalized_at IS DISTINCT FROM OLD.finalized_at
        OR NEW.finalized_snapshot IS DISTINCT FROM OLD.finalized_snapshot
        OR NEW.finalized_snapshot_hash IS DISTINCT FROM OLD.finalized_snapshot_hash
        OR NEW.rendering_version IS DISTINCT FROM OLD.rendering_version
        OR NEW.seller_name_snapshot IS DISTINCT FROM OLD.seller_name_snapshot
        OR NEW.seller_address_line_1_snapshot IS DISTINCT FROM OLD.seller_address_line_1_snapshot
        OR NEW.seller_address_line_2_snapshot IS DISTINCT FROM OLD.seller_address_line_2_snapshot
        OR NEW.seller_city_snapshot IS DISTINCT FROM OLD.seller_city_snapshot
        OR NEW.seller_state_snapshot IS DISTINCT FROM OLD.seller_state_snapshot
        OR NEW.seller_pincode_snapshot IS DISTINCT FROM OLD.seller_pincode_snapshot
        OR NEW.seller_gstin_snapshot IS DISTINCT FROM OLD.seller_gstin_snapshot
        OR NEW.customer_name_snapshot IS DISTINCT FROM OLD.customer_name_snapshot
        OR NEW.customer_address_line_1_snapshot IS DISTINCT FROM OLD.customer_address_line_1_snapshot
        OR NEW.customer_address_line_2_snapshot IS DISTINCT FROM OLD.customer_address_line_2_snapshot
        OR NEW.customer_city_snapshot IS DISTINCT FROM OLD.customer_city_snapshot
        OR NEW.customer_state_snapshot IS DISTINCT FROM OLD.customer_state_snapshot
        OR NEW.customer_pincode_snapshot IS DISTINCT FROM OLD.customer_pincode_snapshot
        OR NEW.customer_gstin_snapshot IS DISTINCT FROM OLD.customer_gstin_snapshot
      ) THEN
        RAISE EXCEPTION 'Finalized sales invoice values are immutable'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- sales_invoice_items: freeze any mutation whose parent invoice is FINALIZED.
  IF TG_OP = 'DELETE' THEN
    parent_id := OLD.invoice_id;
  ELSE
    parent_id := NEW.invoice_id;
  END IF;
  SELECT status INTO parent_status
  FROM public."sales_invoices"
  WHERE id = parent_id;
  IF parent_status IS NULL THEN
    RAISE EXCEPTION 'Sales invoice parent is missing for sales invoice item'
      USING ERRCODE = '23503';
  END IF;
  IF parent_status = 'FINALIZED'::public."InvoiceStatus" THEN
    RAISE EXCEPTION 'Finalized sales invoice lines are immutable'
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS prevent_finalized_sales_mutation ON public."sales_invoices";
CREATE TRIGGER prevent_finalized_sales_mutation
BEFORE UPDATE OR DELETE ON public."sales_invoices"
FOR EACH ROW EXECUTE FUNCTION public.prevent_finalized_sales_mutation();

DROP TRIGGER IF EXISTS prevent_finalized_sales_item_mutation ON public."sales_invoice_items";
CREATE TRIGGER prevent_finalized_sales_item_mutation
BEFORE INSERT OR UPDATE OR DELETE ON public."sales_invoice_items"
FOR EACH ROW EXECUTE FUNCTION public.prevent_finalized_sales_mutation();

REVOKE EXECUTE ON FUNCTION public.prevent_finalized_sales_mutation() FROM PUBLIC;
