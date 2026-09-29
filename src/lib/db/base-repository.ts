import { type PrismaClient, type Prisma } from "@prisma/client";
import type { TenantContext } from "./tenant-context";
import { requireTenant } from "./tenant-context";

export type SortDirection = "asc" | "desc";

export type ListParams<TOrderBy extends Record<string, SortDirection> = Record<string, SortDirection>> = {
  skip?: number;
  take?: number;
  orderBy?: TOrderBy;
  search?: string;
};

export abstract class BaseRepository<TEntity, TCreateInput, TUpdateInput, TId = string> {
  constructor(
    protected readonly prisma: PrismaClient,
    protected readonly tableName: string,
  ) {}

  protected withTenant(ctx: Partial<TenantContext> | null | undefined): TenantContext {
    return requireTenant(ctx);
  }

  abstract getById(id: TId, ctx: TenantContext): Promise<TEntity | null>;
  abstract create(input: TCreateInput, ctx: TenantContext): Promise<TEntity>;
  abstract update(id: TId, input: TUpdateInput, ctx: TenantContext): Promise<TEntity>;
  abstract delete(id: TId, ctx: TenantContext): Promise<void>;
  abstract list(params: ListParams, ctx: TenantContext): Promise<{ items: TEntity[]; total: number }>;
}

export type PagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export function paged<T>(items: T[], total: number, page: number, pageSize: number): PagedResult<T> {
  return { items, total, page, pageSize };
}
