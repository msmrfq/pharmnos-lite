-- Valid context: payload.signature (payload uses | as separator)
SELECT set_config('pharmnos.auth_context', 'v1|auth_user_a|tenant_a|9999999999|aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.57e30a28d5ee4044278059a082561c955933910c2a20512a409a90c18ff0b403', true);
SELECT public.financial_context_tenant_id();
SELECT count(*) FROM public.business_profiles;