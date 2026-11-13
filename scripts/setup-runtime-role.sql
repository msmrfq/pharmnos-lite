DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pharmnos_e2e_runtime') THEN
        CREATE ROLE pharmnos_e2e_runtime LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '5a7D8NJ9obQGHwZ1fdzVqyl3Ytn0CErh';
    ELSE
        ALTER ROLE pharmnos_e2e_runtime WITH LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '5a7D8NJ9obQGHwZ1fdzVqyl3Ytn0CErh';
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO pharmnos_e2e_runtime;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO pharmnos_e2e_runtime;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO pharmnos_e2e_runtime;

-- Insert signing secret
INSERT INTO pharmnos_private.auth_context_keys (key_name, signing_secret)
VALUES ('financial-auth-context', 'zDOuIQVy9U65b8LmsFWaBqeSHdjTJ3khY2RxloEMgAwtGPKir1vZnCpcXN470f')
ON CONFLICT (key_name) DO UPDATE SET signing_secret = EXCLUDED.signing_secret;