# Implementation Log

- Added forward-only supplier-document RLS and active-document uniqueness migration.
- Added supplier upload context revalidation and content-signature validation.
- Reworked persisted PDF rendering to paginate and include required financial/declaration fields.
- Refreshed executable artifact hashes after provisioning changes.
- Preserved existing migrations and worktree state; the applied `0018` migration was not rewritten.
