DO $$
DECLARE
  context text := 'v1|auth_user_a|tenant_a|1794690401|128ac73728eb4f206276178e4757e550|85f6b1b826ce540208345147b4a0f2da1cdbda1de7ace40ccb6cc30923d8cb00';
  payload text;
  supplied_signature text;
  expected_signature text;
  signing_secret text;
  expires_at bigint;
  context_nonce text;
BEGIN
  payload := split_part(context, '.', 1);
  supplied_signature := split_part(context, '.', 2);
  RAISE NOTICE 'payload: %, supplied_sig: %', payload, supplied_signature;
  
  SELECT k.signing_secret INTO signing_secret
  FROM pharmnos_private.auth_context_keys AS k
  WHERE k.key_name = 'financial-auth-context';
  RAISE NOTICE 'signing_secret: %', signing_secret;
  
  expected_signature := encode(public.hmac(payload, signing_secret, 'sha256'), 'hex');
  RAISE NOTICE 'expected_sig: %', expected_signature;
  RAISE NOTICE 'sig match: %', supplied_signature = expected_signature;
  
  IF supplied_signature <> expected_signature THEN
    RAISE NOTICE 'signature mismatch';
    RETURN;
  END IF;
  
  IF split_part(payload, '|', 1) <> 'v1' THEN
    RAISE NOTICE 'version mismatch';
    RETURN;
  END IF;
  
  expires_at := split_part(payload, '|', 4)::bigint;
  RAISE NOTICE 'expires_at: %, now: %', expires_at, extract(epoch FROM clock_timestamp())::bigint;
  
  IF expires_at <= extract(epoch FROM clock_timestamp())::bigint THEN
    RAISE NOTICE 'expired';
    RETURN;
  END IF;
  
  context_nonce := split_part(payload, '|', 5);
  RAISE NOTICE 'nonce: %, matches 32 hex: %', context_nonce, context_nonce ~ '^[0-9a-f]{32}$';
  
  IF context_nonce !~ '^[0-9a-f]{32}$' THEN
    RAISE NOTICE 'nonce format invalid';
    RETURN;
  END IF;
  
  RAISE NOTICE 'all checks passed';
END $$;