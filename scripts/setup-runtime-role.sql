-- Runtime role + signing key template for a disposable verification database.
--
-- Credentials are never committed. Supply them as psql variables, for example:
--   psql -v runtime_password="$FINANCIAL_E2E_RUNTIME_DB_PASSWORD" \
--        -v signing_secret="$DATABASE_AUTH_CONTEXT_SIGNING_SECRET" -f setup-runtime-role.sql
--
-- \gexec runs the generated statements, so the password never appears in this file
-- and psql performs the quoting.

SELECT format(
  'CREATE ROLE pharmnos_e2e_runtime LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD %L',
  :'runtime_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pharmnos_e2e_runtime')
\gexec

SELECT format(
  'ALTER ROLE pharmnos_e2e_runtime WITH LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD %L',
  :'runtime_password'
)
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pharmnos_e2e_runtime')
\gexec

GRANT USAGE ON SCHEMA public TO pharmnos_e2e_runtime;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO pharmnos_e2e_runtime;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO pharmnos_e2e_runtime;

-- Insert signing secret
INSERT INTO pharmnos_private.auth_context_keys (key_name, signing_secret)
VALUES ('financial-auth-context', :'signing_secret')
ON CONFLICT (key_name) DO UPDATE SET signing_secret = EXCLUDED.signing_secret;
