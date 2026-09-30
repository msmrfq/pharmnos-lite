---
title: Local VLESS proxy drops Postgres pg-wire SASL auth packets
date: 2026-09-30
status: Open
---

## Steps to Reproduce
1. Run Windows 10/11 workstation with VLESS/V2Ray SOCKS5 proxy listening on port 10808 intercepting outbound TCP.
2. Configure Prisma / `pg.Pool` connection to Supabase Mumbai pooled endpoint `aws-0-ap-south-1.pooler.supabase.com:6543` or session port 5432.
3. Apply TLS self-signed-chain intercept workaround (Pool `ssl: { rejectUnauthorized: false }` + DSN param `sslaccept=accept_invalid_certs`).
4. Run any script that opens a raw Prisma query or `pg.connect` handshake, e.g. `node scripts/db-tls-smoke.mjs` or a Next.js dev server page that hits the DB on first render.

## Expected Behaviour
After TLS stage succeeds, Postgres sends AuthenticationSASL, client replies SASLInitialResponse with SCRAM-SHA-256, exchange continues, connection authenticated, query returns rows, Prisma client works normally.

## Actual Behaviour
- TCP 3-way handshake succeeds on ports 443 / 5432 / 6543.
- TLS SSLRequest + self-signed intercept chain stage actually succeeds (after parsePgUrl Pool rejectUnauthorized workaround applied).
- Next stage (Postgres binary pg-wire AuthenticationSASL packets / client SASLInitialResponse) is silently DROPPED by the proxy DPI engine.
- After 60s pool `connectionTimeoutMillis`, Prisma surfaces: `Error: Connection terminated due to connection timeout` (Supabase P1001 alias).
- Same exact connection string works from AWS Lambda / Vercel Hobby ap-south-1 runtime; same Supabase project works fine from MCP `execute_sql` over HTTPS 443 API (bypasses pg-wire entirely). Reproduced 3 consecutive runs of `db-tls-smoke.mjs` exit 1.

## Root Cause
Confirmed root cause: local VLESS/V2Ray SOCKS5 proxy (port 10808) performs deep packet inspection on outbound pg-wire protocol and drops the SASL authentication binary exchange after the TLS handshake completes. This is NOT a Supabase pooler instability / Supavisor P1001 rate-limit issue (though symptoms overlap). Evidence: HTTPS 443 path to Supabase works (execute_sql, Storage, Auth); the same proxy config even allows port 5432 TCP open; only the Postgres pg-wire SASL stage fails. Vercel / direct Mumbai network resolves it.

### Resolution options (deferred Future backlog)
- **Chosen workaround TODAY**: Route ALL local Prisma DB writes through Supabase MCP `execute_sql` HTTPS API (works flawlessly); route ALL local RSC page renders through existing `let dbOk` degrade pattern → amber placeholder banner HTTP 200, never crash 500.
- **Option A — code mitigation**: Add Prisma exponential retry wrapper inside `BaseRepository` findMany/create/etc + reconnect with jitter.
- **Option B — infra mitigation**: Bypass proxy for Supabase host IP range in VLESS routing rules / use local direct-network route to Mumbai.
- **Option C — infra upgrade**: Supabase Pro + dedicated compute + session mode direct 5432; OR self-host Postgres; OR local pgwire to localhost-pgbouncer without proxy.
- **Option D — production path resolution**: Deploy Next.js to Vercel Hobby ap-south-1 / us-east-1 → AWS peer network routes cleanly, no local proxy. THIS IS THE ACCEPTED GO-LIVE PATH TODAY.
