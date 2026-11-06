# Infrastructure Inventory

## Current observed Docker state

All listed Docker containers were exited. No active disposable invoice target was available for adoption. Historical financial-E2E PostgreSQL containers remain untouched.

The repository supports a contract-bound PostgreSQL Compose service named `financial-e2e-postgres`, using loopback binding, tmpfs storage, a unique project/database/port, and restricted runtime credentials.

## Application and dependencies

- Next.js App Router application.
- Prisma/PostgreSQL persistence.
- Supabase Auth adapter.
- Supabase Storage adapter using a service-role boundary.
- `pdf-lib`, `qrcode`, and `bwip-js` for invoice artifacts.
- Browser automation tooling is available, but an isolated auth/storage backend is not configured.

