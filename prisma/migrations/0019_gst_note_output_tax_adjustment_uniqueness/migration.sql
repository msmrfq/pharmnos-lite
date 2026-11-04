-- 0019 allow only one completed output-tax eligibility adjustment per GST note
CREATE UNIQUE INDEX "gst_note_output_tax_adjustment_completed_key"
ON "gst_note_posting_operations" ("tenant_id", "note_id", "operation_type")
WHERE "operation_type" = 'OUTPUT_TAX_ELIGIBILITY_ADJUSTMENT'
  AND "status" = 'COMPLETED';
