"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, FileText } from "lucide-react";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";

type DeleteActionFn = (id: string) => Promise<ActionResult<{ id: string }>>;

type Props = {
  entityId: string;
  entityLabel: string;
  editHref: string;
  deleteAction: DeleteActionFn;
};

export default function CustomerActionsCell({ entityId, entityLabel, editHref, deleteAction }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const onDelete = async () => {
    const confirmed = window.confirm(
      `Delete ${entityLabel.toLowerCase()}? This marks it inactive (keeps all invoices and ledger history).`,
    );
    if (!confirmed) return;
    startTransition(async () => {
      try {
        const result = await deleteAction(entityId);
        if (result.ok) {
          toast({
            variant: "success",
            title: `${entityLabel} deleted`,
            description: `${entityLabel} has been marked inactive.`,
            duration: 4500,
          });
          router.refresh();
        } else {
          toast({
            variant: "destructive",
            title: `Could not delete ${entityLabel.toLowerCase()}`,
            description: result.message ?? "Unknown error.",
            duration: 5500,
          });
        }
      } catch (_e) {
        toast({
          variant: "destructive",
          title: `Could not delete ${entityLabel.toLowerCase()}`,
          duration: 5500,
        });
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Button asChild size="sm" variant="secondary">
        <Link href={editHref} aria-label={`Edit ${entityLabel}`}>
          <Pencil className="h-3.5 w-3.5" />
        </Link>
      </Button>
      <Button
        size="sm"
        variant="secondary"
        type="button"
        aria-label={`Delete ${entityLabel}`}
        disabled={pending}
        onClick={onDelete}
      >
        <Trash2 className={`h-3.5 w-3.5 ${pending ? "animate-pulse" : ""}`} />
      </Button>
      <Button variant="ghost" size="sm" asChild>
        <Link
          href={`/customers/${encodeURIComponent(entityId)}/statement/print`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Print statement"
        >
          <FileText className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
