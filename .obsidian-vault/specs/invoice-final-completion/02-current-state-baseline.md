# Current-State Baseline

- Stack: Next.js App Router, Prisma/PostgreSQL, Supabase adapters, provider-independent storage interface.
- Previous invoice lifecycle implementation had PDF, QR, barcode, supplier-document, snapshot, and artifact metadata paths.
- Docker daemon was available with no pre-existing containers at campaign start.
- A new contract-bound PostgreSQL target was created on loopback with tmpfs storage and a unique Compose project/database identity.
- Existing worktree changes were preserved; no destructive Git command was used.
- Authenticated browser and private-storage runtime targets were not available without using production/shared credentials, so those gates remain open.
