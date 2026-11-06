# Architecture and Data Contract

Supplier originals, internal purchase records, and generated sales invoices remain distinct. Supplier documents use tenant-scoped private-storage keys and append-only replacement metadata. Finalized sales rendering uses the persisted immutable snapshot; legacy/non-finalized compatibility rendering remains explicitly outside snapshot-only evidence.

PDF generation is post-finalization and idempotent. A PDF failure records an artifact failure and does not roll back financial posting or release invoice numbering.

The Financial E2E target contract is the sole target identity: loopback host, non-default port, database name, bootstrap/runtime roles, credential-source names, Compose project/service/profile, schema artifact hash, run ID, and expiry.
