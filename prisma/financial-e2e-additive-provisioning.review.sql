-- REVIEW ARTIFACT ONLY - DO NOT EXECUTE WITHOUT SEPARATE AUTHORIZATION.
-- This wrapper is intentionally incomplete until the restricted backend role,
-- controlled function owner, grants, RLS policies, and immutable-history
-- controls are approved as concrete implementation artifacts.
--
-- The included generated SQL is a complete from-empty Prisma baseline. It is
-- not an additive migration for a populated database. A final wrapper must retain
-- these guards and add the approved controls before execution.

\set ON_ERROR_STOP on

BEGIN;

DO $guard$
DECLARE
  existing_objects integer;
BEGIN
  SELECT count(*)
    INTO existing_objects
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f');

  IF existing_objects <> 0 THEN
    RAISE EXCEPTION
      'STOP: public schema is not empty; use an approved additive migration';
  END IF;
END
$guard$;

-- Review-only inclusion of the complete Prisma baseline:
\ir financial-e2e-schema-provisioning.generated.sql

-- STOP: approved grants, forced-RLS policies, immutable-history controls,
-- posting-transition safeguards, and post-provision catalog assertions must be
-- added and reviewed before this wrapper can be executable.
ROLLBACK;
