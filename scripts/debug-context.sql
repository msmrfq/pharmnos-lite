SELECT set_config('pharmnos.auth_context', 'v1|auth_user_a|tenant_a|9999999999|testnonce|invalidsig', true);
SELECT public.financial_context_tenant_id(), public.financial_context_subject_id();
SELECT count(*) FROM public.business_profiles;