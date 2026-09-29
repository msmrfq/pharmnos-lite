import type { product_batches } from "@prisma/client";

export type FefoRequest = {
  product_id: string;
  required_quantity: number;
  as_of_date?: Date;
  skip_blocked?: boolean;
  preferred_batch_ids?: string[];
  min_expiry_date?: Date;
};

export type FefoBatchPick = {
  batch_id: string;
  batch_no: string;
  expiry_date?: Date | null;
  total_available: number;
  allocated_quantity: number;
  unit_rate?: number | null;
  is_blocked: boolean;
  distance_days?: number;
};

export type FefoAllocation = {
  product_id: string;
  requested: number;
  fulfilled: number;
  shortfall: number;
  batches: FefoBatchPick[];
};

function daysBetween(a: Date, b: Date): number {
  const MS = 24 * 60 * 60 * 1000;
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((ua - ub) / MS);
}

export function allocateBatchesFefo(
  request: FefoRequest,
  batches: Array<Partial<product_batches> & { id: string; batch_no: string }>,
): FefoAllocation {
  const asOf = request.as_of_date ?? new Date();
  let required = Math.max(0, Math.round(request.required_quantity));
  const picks: FefoBatchPick[] = [];

  const preferredSet = new Set(request.preferred_batch_ids ?? []);

  const sort = (
    a: Partial<product_batches> & { id: string; batch_no: string },
    b: Partial<product_batches> & { id: string; batch_no: string },
  ) => {
    const aPref = preferredSet.has(a.id) ? 0 : 1;
    const bPref = preferredSet.has(b.id) ? 0 : 1;
    if (aPref !== bPref) return aPref - bPref;
    if (request.min_expiry_date) {
      const aExp = a.expiry_date ?? new Date(0);
      const bExp = b.expiry_date ?? new Date(0);
      if (aExp < request.min_expiry_date && bExp >= request.min_expiry_date) return 1;
      if (bExp < request.min_expiry_date && aExp >= request.min_expiry_date) return -1;
    }
    const aEx = a.expiry_date ? a.expiry_date.getTime() : Number.POSITIVE_INFINITY;
    const bEx = b.expiry_date ? b.expiry_date.getTime() : Number.POSITIVE_INFINITY;
    if (aEx !== bEx) return aEx - bEx;
    return (a.created_at?.getTime() ?? 0) - (b.created_at?.getTime() ?? 0);
  };

  const candidates = [...batches]
    .filter((b) => {
      if (request.skip_blocked !== false && b.is_blocked) return false;
      const avail = Number(b.available_qty ?? 0);
      if (avail <= 0) return false;
      return true;
    })
    .sort(sort);

  for (const b of candidates) {
    if (required <= 0) break;
    const avail = Math.max(0, Number(b.available_qty ?? 0));
    if (avail <= 0) continue;
    const qty = Math.min(required, avail);
    picks.push({
      batch_id: b.id,
      batch_no: b.batch_no,
      expiry_date: b.expiry_date ?? null,
      total_available: avail,
      allocated_quantity: qty,
      unit_rate: (b as any).sale_rate ?? (b as any).purchase_rate ?? null,
      is_blocked: !!b.is_blocked,
      distance_days: b.expiry_date ? daysBetween(b.expiry_date, asOf) : undefined,
    });
    required -= qty;
  }

  const fulfilled = Math.round(picks.reduce((s, p) => s + p.allocated_quantity, 0));
  return {
    product_id: request.product_id,
    requested: Math.round(request.required_quantity),
    fulfilled,
    shortfall: Math.max(0, Math.round(request.required_quantity) - fulfilled),
    batches: picks,
  };
}

export class FefoBatchPickerService {
  pick(
    request: FefoRequest,
    batches: Array<Partial<product_batches> & { id: string; batch_no: string }>,
  ): FefoAllocation {
    return allocateBatchesFefo(request, batches);
  }

  pickMany(
    requests: FefoRequest[],
    getBatchesByProduct: (productId: string) => Array<
      Partial<product_batches> & { id: string; batch_no: string }
    >,
  ): FefoAllocation[] {
    return requests.map((req) => this.pick(req, getBatchesByProduct(req.product_id)));
  }
}

export const fefoBatchPicker = new FefoBatchPickerService();
