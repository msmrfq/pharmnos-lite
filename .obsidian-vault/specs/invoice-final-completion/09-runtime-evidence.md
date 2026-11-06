# Runtime Evidence

Disposable target initialization completed successfully for the campaign target contract. Evidence showed:

- PostgreSQL `postgres:17-alpine` on loopback and a unique non-default port.
- Exact Compose project/service/profile and tmpfs isolation.
- Bootstrap database identity matched the authorized database.
- Runtime role `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`.
- Runtime role had zero DELETE privileges.
- Schema baseline and RLS/provisioning checks passed.

The recovered earlier target was stale because its evidence was bound to a prior schema-artifact hash. It was not reused. A fresh current-source target was initialized and verified with the same structural results. This proves target setup and RLS posture only; authenticated browser behavior, private storage behavior, current-source invoice artifact read-back, migration-ledger execution, and invoice mutation scenarios remain explicitly unverified.
