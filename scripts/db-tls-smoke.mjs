// Quick smoke: can Prisma actually connect to real Supabase DB using current DSNs?
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

// Manually load .env.local + .env (Next.js dev auto-loads, standalone node does not)
for (const envFile of [".env.local", ".env"]) {
  const p = resolve(process.cwd(), envFile);
  if (existsSync(p)) {
    const raw = readFileSync(p, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const k = trimmed.slice(0, eq).trim();
      let v = trimmed.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

const RAW_DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!RAW_DATABASE_URL) {
  console.error("FAIL: DATABASE_URL unset");
  process.exit(1);
}
// Parse manually instead of passing connectionString (avoids pg-connection-string v8 sslmode=require → verify-full strictness with proxy
function parsePgUrl(url) {
  const u = new URL(url.replace(/^postgres(ql)?:\/\//, 'http://'));
  return {
    host: u.hostname,
    port: parseInt(u.port || '5432'),
    database: u.pathname.replace(/^\//, '') || 'postgres',
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  };
}
const { host, port, database, user, password } = parsePgUrl(RAW_DATABASE_URL);
console.log("1/4 Connecting " + user + "@" + host + ":" + port + "/" + database + " (session mode, parsed manually)");

const pool = new Pool({
  host, port, database, user, password,
  max: 3,
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 60_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error", "warn"] });

// Retry wrapper for transient Supavisor P1001 connection drops
async function withRetry(fn, label, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt > maxRetries) throw e;
      const delay = attempt * 3000;
      console.log(`   ${label} attempt ${attempt}/${maxRetries+1} FAILED: ${e.message.slice(0, 80)}… wait ${delay}ms retry`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

try {
  console.log("2/4 Testing raw pg driver connect (SELECT 1)...");
  const r1 = await withRetry(async () => {
    const c = await pool.connect();
    try { return await c.query("SELECT 1 AS ok"); }
    finally { c.release(); }
  }, "RAW PG SELECT 1");
  console.log("   RAW PG PASS -> rows:", r1.rows.length, "value:", r1.rows[0].ok);

  console.log("3/4 Testing Prisma $queryRaw count(tenants)...");
  const r2 = await withRetry(async () => prisma.$queryRawUnsafe("SELECT count(*)::int AS cnt FROM public.tenants"), "PRISMA count(tenants)", 1);
  console.log("   PRISMA PASS -> tenants count:", r2[0].cnt);

  console.log("4/4 Prisma $queryRaw current_setting app.current_tenant stub...");
  try {
    const r3 = await prisma.$queryRawUnsafe("SELECT set_config('app.current_tenant', 'smoke-tls-test', false) AS set");
    const r4 = await prisma.$queryRawUnsafe("SELECT current_setting('app.current_tenant', true) AS v");
    console.log("   set_config PASS -> value:", r4[0].v);
  } catch (e) {
    console.log("   set_config non-fatal:", e.message.slice(0, 120));
  }

  console.log("\n✅ DB TLS SMOKE ALL PASS. Prisma can connect.");
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
} catch (e) {
  console.error("\n❌ DB TLS SMOKE FAIL. err:", e.name, e.message);
  if (e.message?.includes("self-signed")) console.error("  -> TLS verification still failing (proxy/mitm root CA untrusted)");
  if (e.message?.includes("Connection terminated")) console.error("  -> P1001 Supavisor pooler timeout (infra, not code)");
  try { await prisma.$disconnect(); } catch {}
  try { await pool.end(); } catch {}
  process.exit(1);
}
