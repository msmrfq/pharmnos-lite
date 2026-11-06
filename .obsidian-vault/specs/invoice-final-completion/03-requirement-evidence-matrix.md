# Requirement Evidence Matrix

The canonical 100-point denominator remains [.obsidian-vault/specs/09-requirement-evidence-matrix.md](../09-requirement-evidence-matrix.md). This campaign does not remove, split, or reweight requirements.

Current status summary:

- Implemented/static: invoice snapshots, supplier metadata, PDF lifecycle, QR/barcode generation, tenant-scoped keys, authorization checks, forward-only supplier-document RLS migration, active-document uniqueness guard, and contract-bound disposable PostgreSQL provisioning.
- Current-source tests: full JavaScript regression 286/286; invoice lifecycle and provisioning contracts 15/15; typecheck, Prisma validation with safe placeholders, changed-file lint, production build, and `git diff --check` passed.
- Runtime verified: disposable PostgreSQL identity, schema, restricted runtime role, RLS/provisioning evidence.
- Not runtime verified: private storage read/write, authenticated purchase browser workflow, authenticated sales browser workflow, PDF artifact read-back, QR/barcode decode, fault injection, and snapshot reprint after mutable-data changes.
- Independently accepted: not established.
