DO $$
DECLARE
  context text := 'v1|auth_user_a|tenant_a|9999999999|aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.57e30a28d5ee4044278059a082561c955933910c2a20512a409a90c18ff0b403';
  payload text;
  supplied_signature text;
  expected_signature text;
  signing_secret text;
  expires_at bigint;
  context_nonce text;
  context_subject text;
  context_tenant text;
  accepted_transaction_id bigint;
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
  
  context_subject := NULLIF(split_part(payload, '|', 2), '');
  context_tenant := NULLIF(split_part(payload, '|', 3), '');
  RAISE NOTICE 'subject: %, tenant: %', context_subject, context_tenant;
  
  IF context_subject IS NULL THEN
    RAISE NOTICE 'subject null';
    RETURN;
  END IF;
  
  IF context_tenant IS NULL THEN
    SELECT min(m.tenant_id::text) INTO context_tenant
    FROM public.users AS u
    JOIN public.memberships AS m ON m.user_id = u.id
    WHERE u.external_id = context_subject
      AND m.status = 'active'
    HAVING count(*) = 1;
    RAISE NOTICE 'lookup tenant: %', context_tenant;
  END IF;
  
  IF context_tenant IS NULL THEN
    RAISE NOTICE 'tenant null after lookup';
    RETURN;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS u
    JOIN public.memberships AS m ON m.user_id = u.id
    WHERE u.external_id = context_subject
      AND m.tenant_id::text = context_tenant
      AND m.status = 'active'
  ) THEN
    RAISE NOTICE 'membership not found';
    RETURN;
  END IF;
  
  RAISE NOTICE 'membership verified';
  
  INSERT INTO pharmnos_private.auth_context_replays (nonce, first_transaction_id)
  VALUES (context_nonce, txid_current())
  ON CONFLICT (nonce) DO NOTHING;
  
  SELECT r.first_transaction_id INTO accepted_transaction_id
  FROM pharmnos_private.auth_context_replays AS r
  WHERE r.nonce = context_nonce;
  RAISE NOTICE 'replay txid: %, current: %', accepted_transaction_id, txid_current();
  
  IF accepted_transaction_id <> txid_current() THEN
    RAISE NOTICE 'replay mismatch';
    RETURN;
  END IF;
  
  RAISE NOTICE 'SUCCESS: subject=%, tenant=%', context_subject, context_tenant;
END $$;