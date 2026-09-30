"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Pencil, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import {
  cancelPurchaseDraftAction,
  finalizePurchaseAction,
} from "@/app/_actions/purchases.actions";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";
import type { purchase_invoices } from "@prisma/client";

type Props = {
  purchaseId: string;
  status: string;
  invoiceNo: string;
};

export default function PurchaseActionsCell({ purchaseId, status, invoiceNo }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [finalizePending, startFinalize] = useTransition();
  const [cancelPending, startCancel] = useTransition();
  const isDraft = status === "DRAFT";

  const onFinalize = async () => {
    if (!isDraft) return;
    const ok = window.confirm(`Finalize purchase ${invoiceNo || purchaseId}?\nThis creates stock movements and supplier ledger impact — cannot be undone.`);
    if (!ok) return;
    startFinalize(async () => {
      try {
        const bound: any = (finalizePurchaseAction as any).bind(null, purchaseId);
        const result: ActionResult<purchase_invoices> = await bound({ ok: false }, new FormData());
        if (result.ok) {
          toast({
            variant: "success",
            title: "Purchase finalized",
            description: "Stock and supplier payable updated.",
            duration: 5500,
          });
          router.refresh();
        } else {
          toast({
            variant: "destructive",
            title: "Could not finalize purchase",
            description: result.message ?? "Unknown error.",
            duration: 5500,
          });
        }
      } catch (_e) {
        toast({
          variant: "destructive",
          title: "Could not finalize purchase",
          duration: 5500,
        });
      }
    });
  };

  const onCancel = async () => {
    if (!isDraft) return;
    const ok = window.confirm(`Cancel draft purchase ${invoiceNo || purchaseId}?`);
    if (!ok) return;
    startCancel(async () => {
      try {
        const result = await cancelPurchaseDraftAction(purchaseId);
        if (result.ok) {
          toast({
            variant: "success",
            title: "Purchase draft cancelled",
            duration: 4500,
          });
          router.refresh();
        } else {
          toast({
            variant: "destructive",
            title: "Could not cancel purchase",
            description: result.message ?? "Unknown error.",
            duration: 5500,
          });
        }
      } catch (_e) {
        toast({
          variant: "destructive",
          title: "Could not cancel purchase",
          duration: 5500,
        });
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        size="sm"
        variant="secondary"
        type="button"
        aria-label="View purchase"
        disabled
        title="View (Phase 5)"
        className="opacity-50"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </Button>
      {isDraft && (
        <>
          <Button
            size="sm"
            type="button"
            aria-label="Finalize"
            disabled={finalizePending}
            onClick={onFinalize}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle2 className={`h-3.5 w-3.5 ${finalizePending ? "animate-pulse" : ""}`} /> Finalize
          </Button>
          <Button
            size="sm"
            variant="secondary"
            type="button"
            aria-label="Cancel draft"
            disabled={cancelPending}
            onClick={onCancel}
          >
            <XCircle className={`h-3.5 w-3.5 ${cancelPending ? "animate-pulse" : ""}`} /> Cancel
          </Button>
        </>
      )}
    </div>
  );
}
