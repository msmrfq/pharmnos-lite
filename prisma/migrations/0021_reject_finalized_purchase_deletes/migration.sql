CREATE OR REPLACE FUNCTION public.reject_finalized_purchase_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  purchase_status public."InvoiceStatus";
BEGIN
  IF TG_TABLE_NAME = 'purchase_invoices' THEN
    IF OLD.status = 'FINALIZED'::public."InvoiceStatus" THEN
      RAISE EXCEPTION 'Finalized purchase invoices cannot be deleted'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  SELECT status
  INTO purchase_status
  FROM public."purchase_invoices"
  WHERE id = OLD.purchase_id
    AND tenant_id = OLD.tenant_id;

  IF purchase_status = 'FINALIZED'::public."InvoiceStatus" THEN
    RAISE EXCEPTION 'Finalized purchase invoice items cannot be deleted'
      USING ERRCODE = '42501';
  END IF;

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS reject_finalized_purchase_invoice_delete
  ON public."purchase_invoices";
CREATE TRIGGER reject_finalized_purchase_invoice_delete
BEFORE DELETE ON public."purchase_invoices"
FOR EACH ROW EXECUTE FUNCTION public.reject_finalized_purchase_delete();

DROP TRIGGER IF EXISTS reject_finalized_purchase_item_delete
  ON public."purchase_invoice_items";
CREATE TRIGGER reject_finalized_purchase_item_delete
BEFORE DELETE ON public."purchase_invoice_items"
FOR EACH ROW EXECUTE FUNCTION public.reject_finalized_purchase_delete();

REVOKE EXECUTE ON FUNCTION public.reject_finalized_purchase_delete() FROM PUBLIC;

-- The original combined triggers must not shadow the dedicated delete guards.
DROP TRIGGER IF EXISTS prevent_finalized_purchase_mutation
  ON public."purchase_invoices";
CREATE TRIGGER prevent_finalized_purchase_mutation
BEFORE UPDATE ON public."purchase_invoices"
FOR EACH ROW EXECUTE FUNCTION public.prevent_finalized_purchase_mutation();

-- The original combined item trigger rejects the parent-missing state produced
-- by a legitimate ON DELETE CASCADE from a draft purchase. Keep its update
-- protection, and let the dedicated delete guard decide finalized deletes.
DROP TRIGGER IF EXISTS prevent_finalized_purchase_item_mutation
  ON public."purchase_invoice_items";
CREATE TRIGGER prevent_finalized_purchase_item_mutation
BEFORE UPDATE ON public."purchase_invoice_items"
FOR EACH ROW EXECUTE FUNCTION public.prevent_finalized_purchase_mutation();
