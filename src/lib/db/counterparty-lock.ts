import { Prisma } from "@prisma/client";

type CounterpartyKind = "customer" | "supplier";

export async function lockCounterpartyBalance(
  tx: { $executeRaw: (query: Prisma.Sql) => Promise<unknown> },
  tenantId: string,
  kind: CounterpartyKind,
  counterpartyId: string,
): Promise<void> {
  const lockKey = `${tenantId}:commercial-${kind}:${counterpartyId}`;
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
  `);
}
