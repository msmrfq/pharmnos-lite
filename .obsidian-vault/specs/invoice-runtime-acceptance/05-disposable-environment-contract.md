# Disposable Environment Contract

The campaign created and disposed one fresh target:

- Run ID: `invoiceclose_20261106_2232`
- Database: `pharmnos_financial_e2e_invoiceclose20261106`
- Host/port: `127.0.0.1:55492`
- Compose project: `pharmnoslite-financial-e2e-invoiceclose20261106`
- Image/service: `postgres:17-alpine` / `financial-e2e-postgres`
- Storage: tmpfs, restart policy `no`
- Cleanup: exact full container identity verified; Compose disposal passed

The target was not reused after earlier historical targets were rejected as stale.

Any future target must be created through the repository target-contract lifecycle with:

- loopback host;
- non-default disposable port;
- unique disposable database and Compose project;
- exact source/schema artifact fingerprint;
- bootstrap role `pharmnos_e2e`;
- runtime role `pharmnos_e2e_runtime`;
- runtime role attributes `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`;
- separate bootstrap/runtime credential environment variables;
- exact cleanup authorization bound to the created container identity.

No credentials or connection strings are recorded here.
