"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ExternalLink, ShieldCheck } from "lucide-react";
import {
  acceptPurchaseGstAction,
  cancelPurchaseDraftAction,
  finalizePurchaseAction,
  resolvePurchaseGstDiscrepancyAction,
} from "@/app/_actions/purchases.actions";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";
import type { purchase_invoices } from "@prisma/client";

type Props = {
  purchaseId: string;
  status: string;
  invoiceNo: string;
  gstReconciliationStatus: string;
  gstAcceptanceStatus: string;
};

export default function PurchaseActionsCell({
  purchaseId,
  status,
  invoiceNo,
  gstReconciliationStatus,
  gstAcceptanceStatus,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [finalizePending, startFinalize] = useTransition();
  const [cancelPending, startCancel] = useTransition();
  const isDraft = status === "DRAFT";
  const canAcceptGst = isDraft && gstReconciliationStatus === "MATCHED" && gstAcceptanceStatus !== "ACCEPTED";
  const canResolveGst = isDraft && gstReconciliationStatus === "DISCREPANCY_REQUIRES_REVIEW" && gstAcceptanceStatus !== "ACCEPTED";

  const onAcceptGst = async () => {
    if (!canAcceptGst) return;
    const decisionReference = window.prompt("Accounting decision reference");
    if (!decisionReference?.trim()) return;
    const rationale = window.prompt("Accounting rationale");
    if (!rationale?.trim()) return;
    const source = window.prompt("Accepted value source: SUPPLIER_DECLARED or APPLICATION_CALCULATED", "SUPPLIER_DECLARED");
    if (source !== "SUPPLIER_DECLARED" && source !== "APPLICATION_CALCULATED") return;
    const formData = new FormData();
    formData.set("decision_reference", decisionReference);
    formData.set("rationale", rationale);
    formData.set("accepted_value_source", source);
    startFinalize(async () => {
      const result = await acceptPurchaseGstAction(purchaseId, formData);
      if (result.ok) {
        toast({ variant: "success", title: "GST acceptance recorded", duration: 4500 });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Could not accept GST", description: result.message ?? "Unknown error.", duration: 5500 });
      }
    });
  };

  const onResolveGst = async () => {
    if (!canResolveGst) return;
    const decisionReference = window.prompt("Resolution decision reference");
    const decision = window.prompt("Resolution decision");
    const rationale = window.prompt("Resolution rationale");
    const source = window.prompt("Accepted value source: SUPPLIER_DECLARED, APPLICATION_CALCULATED, or EXPLICIT_DECISION", "EXPLICIT_DECISION");
    if (!decisionReference?.trim() || !decision?.trim() || !rationale?.trim()) return;
    if (source !== "SUPPLIER_DECLARED" && source !== "APPLICATION_CALCULATED" && source !== "EXPLICIT_DECISION") return;
    const formData = new FormData();
    formData.set("decision_reference", decisionReference);
    formData.set("decision", decision);
    formData.set("rationale", rationale);
    formData.set("accepted_value_source", source);
    for (const field of ["taxable_value", "cgst", "sgst", "igst", "cess", "invoice_total", "round_off"]) {
      const value = window.prompt(`Accepted ${field}`);
      if (!value?.trim()) return;
      formData.set(`accepted_${field}`, value);
    }
    startFinalize(async () => {
      const result = await resolvePurchaseGstDiscrepancyAction(purchaseId, formData);
      if (result.ok) {
        toast({ variant: "success", title: "GST discrepancy resolved", duration: 4500 });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Could not resolve GST discrepancy", description: result.message ?? "Unknown error.", duration: 5500 });
      }
    });
  };

  const onFinalize = async () => {
    if (!isDraft) return;
    const ok = window.confirm(`Finalize purchase ${invoiceNo || purchaseId}?\nThis creates stock movements and supplier ledger impact — cannot be undone.`);
    if (!ok) return;
    startFinalize(async () => {
      try {
        const bound: any = (finalizePurchaseAction as any).bind(null, purchaseId);
        const formData = new FormData();
        formData.set("idempotency_key", `purchase:${purchaseId}:finalize`);
        const result: ActionResult<purchase_invoices> = await bound({ ok: false }, formData);
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
          {canResolveGst && (
            <Button
              size="sm"
              variant="secondary"
              type="button"
              aria-label="Resolve purchase GST discrepancy"
              disabled={finalizePending}
              onClick={onResolveGst}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Resolve GST
            </Button>
          )}
          {canAcceptGst && (
            <Button
              size="sm"
              variant="secondary"
              type="button"
              aria-label="Accept purchase GST"
              disabled={finalizePending}
              onClick={onAcceptGst}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Accept GST
            </Button>
          )}
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
