"use client";

import { ReactElement, cloneElement, isValidElement, useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createStockAdjustmentAction } from "@/app/_actions/purchases.actions";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";
import { useToast } from "@/hooks/use-toast";

type BatchLite = {
  id: string;
  batch_no: string;
  expiry_date?: Date | string | null;
  available_qty?: number | string | null;
};

type ProductLite = {
  id: string;
  name: string;
  sku?: string | null;
  batches: BatchLite[];
};

type Props = {
  product: ProductLite;
  trigger: ReactElement;
};

const REASONS = [
  "Damaged",
  "Expired write-off",
  "Found / Stock count correction",
  "Other",
] as const;

export default function StockAdjustmentDialog({ product, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useFormState<ActionResult<{ id: string }>, FormData>(
    createStockAdjustmentAction as any,
    { ok: false, errors: undefined, message: undefined },
  );
  const [batchId, setBatchId] = useState<string>(product.batches[0]?.id ?? "");
  const router = useRouter();
  const { toast } = useToast();
  const [, startTx] = useTransition();

  useEffect(() => {
    if (product.batches.length > 0 && !batchId) {
      const first = product.batches[0];
      if (first) setBatchId(first.id);
    }
  }, [product.batches, batchId]);

  useEffect(() => {
    if (state.ok === true) {
      toast({ title: "Stock adjusted", description: "Movement recorded successfully." });
      setOpen(false);
      startTx(() => router.refresh());
    } else if (state.ok === false && state.message) {
      toast({ title: "Adjustment failed", description: state.message, variant: "destructive" });
    }
  }, [state, router, toast]);

  const err = state.errors ?? {};

  const triggerEl = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<any>, {
        onClick: (e: any) => {
          (trigger as any).props?.onClick?.(e);
          setOpen(true);
        },
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{triggerEl}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjust stock — {product.name}</DialogTitle>
          <DialogDescription>
            Use positive values for stock-in, negative values for stock-out.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4 mt-2">
          <input type="hidden" name="product_id" value={product.id} />

          <div className="space-y-1.5">
            <Label htmlFor="adjust-batch">Batch *</Label>
            <Select
              name="batch_id"
              value={batchId}
              onValueChange={(v) => setBatchId(v)}
              disabled={isPending}
            >
              <SelectTrigger id="adjust-batch">
                <SelectValue placeholder="Select batch" />
              </SelectTrigger>
              <SelectContent>
                {product.batches.map((b) => {
                  const avail = Number(b.available_qty ?? 0);
                  const exp = b.expiry_date ? new Date(b.expiry_date) : null;
                  const expStr = exp
                    ? exp.toLocaleDateString("en-IN", { month: "short", year: "numeric" })
                    : "no expiry";
                  return (
                    <SelectItem key={b.id} value={b.id}>
                      {b.batch_no} · avail {avail} · exp {expStr}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {err.batch_id && <p className="text-caption text-destructive">{err.batch_id[0]}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adjust-delta">Quantity delta (+/-) *</Label>
            <Input
              id="adjust-delta"
              name="quantity_delta"
              type="number"
              step="1"
              placeholder="e.g. -2 or 5"
              disabled={isPending}
            />
            <p className="text-caption text-muted">
              Positive → stock-in (ADJUSTMENT_IN). Negative → stock-out (ADJUSTMENT_OUT).
              Negative values cannot exceed available qty for the chosen batch.
            </p>
            {err.quantity_delta && (
              <p className="text-caption text-destructive">{err.quantity_delta[0]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adjust-reason">Reason *</Label>
            <Select name="reason" disabled={isPending} defaultValue="Other">
              <SelectTrigger id="adjust-reason">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err.reason && <p className="text-caption text-destructive">{err.reason[0]}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adjust-notes">Notes (optional)</Label>
            <Textarea
              id="adjust-notes"
              name="notes"
              rows={3}
              placeholder="Optional context"
              maxLength={500}
              disabled={isPending}
            />
            {err.notes && <p className="text-caption text-destructive">{err.notes[0]}</p>}
          </div>

          {state.ok === false && state.message && !err && (
            <p className="text-caption text-destructive">{state.message}</p>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || product.batches.length === 0}>
              {isPending ? "Recording…" : "Record adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
