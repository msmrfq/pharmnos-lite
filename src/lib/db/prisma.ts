import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }
  const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 15_000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type { PrismaClient };

export function isPostgresConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  const u = url.toLowerCase();
  if (u.includes("localhost") || u.includes("127.0.0.1")) return false;
  if (u.includes("postgres:postgres@")) return false;
  return true;
}

export function assertPostgresConfigured(context: string): void {
  if (isPostgresConfigured()) return;
  throw new Error(
    `${context}: DATABASE_URL in .env.local still points to a default local Supabase stack. ` +
      `Paste the real Supabase Free Postgres connection strings into .env.local before running DB operations. ` +
      `See Supabase Dashboard → Project Settings → Database → Connection string (URI).`,
  );
}
