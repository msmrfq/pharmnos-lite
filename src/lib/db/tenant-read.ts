import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  establishTenantContext,
  requireServerTenantContext,
  type TenantContext,
} from "@/lib/db/tenant-context";
import { createRepositories, type Repositories } from "@/repositories";

/**
 * Transaction-scoped, tenant-bound database access.
 *
 * Every in-scope read path (RSC loader, report, print view, dashboard, export)
 * must acquire its client from this module instead of the module-level
 * `repos`/`prisma` singletons. The repositories returned here are bound to a
 * single interactive transaction whose `pharmnos.auth_context` GUC has been
 * set with `set_config(..., true)`, so the context is transaction-local and
 * cannot leak across pooled connections.
 *
 * The tenant identity always comes from `requireServerTenantContext()`, which
 * derives it from the server-verified session and membership. No caller can
 * supply a tenant id.
 */
export type TenantTransactionScope = {
  ctx: TenantContext;
  tx: Prisma.TransactionClient;
  repos: Repositories;
};

export type TenantTransactionOptions = {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  maxWait?: number;
  timeout?: number;
};

/**
 * Server-rendered read paths can batch several list queries (25k-row
 * reference data) on one connection, so the interactive transaction needs a
 * longer budget than Prisma's 5s default. The wait cap only applies when the
 * pool is saturated.
 */
const DEFAULT_MAX_WAIT_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 15_000;

async function runTenantTransaction<T>(
  ctx: TenantContext,
  fn: (scope: TenantTransactionScope) => Promise<T>,
  options: TenantTransactionOptions,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await establishTenantContext(tx, ctx);
      return fn({ ctx, tx, repos: createRepositories(tx) });
    },
    {
      maxWait: options.maxWait ?? DEFAULT_MAX_WAIT_MS,
      timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
      ...(options.isolationLevel ? { isolationLevel: options.isolationLevel } : {}),
    },
  );
}

/**
 * Derives a server-verified tenant context, opens one transaction, installs
 * the signed context inside it, and runs `fn` with transaction-bound
 * repositories. Throws (fails closed) when no trusted context exists.
 */
export async function withTenantTransaction<T>(
  fn: (scope: TenantTransactionScope) => Promise<T>,
  options: TenantTransactionOptions = {},
): Promise<T> {
  const ctx = await requireServerTenantContext();
  return runTenantTransaction(ctx, fn, options);
}

/**
 * Same guarantees as `withTenantTransaction`, but reuses a context that the
 * caller already obtained from `requireServerTenantContext()` in the same
 * request. Use this when the context is also needed outside the transaction
 * (for example to gate UI) so the session is not resolved twice.
 *
 * Never pass a tenant id that originated from a request parameter, header, or
 * any other client-controlled source.
 */
export async function withVerifiedTenantTransaction<T>(
  ctx: TenantContext,
  fn: (scope: TenantTransactionScope) => Promise<T>,
  options: TenantTransactionOptions = {},
): Promise<T> {
  return runTenantTransaction(ctx, fn, options);
}

/** Read-path alias for `withTenantTransaction`. */
export const withTenantRepositories = withTenantTransaction;
