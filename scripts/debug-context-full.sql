BEGIN;
SELECT set_config('pharmnos.auth_context', 'v1|auth_user_a|tenant_a|9999999999|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.3b6d78a6ec4b4648b5d04a7dbf3daa61c0572d28ebec3e43606f96223987dd29', true);
SELECT current_setting('pharmnos.auth_context', true) AS ctx;
SELECT public.financial_context_tenant_id() AS tenant_id;
SELECT count(*) FROM public.business_profiles;
COMMIT;