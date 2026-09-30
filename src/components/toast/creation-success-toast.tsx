"use client";

import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  entityLabel: string;
  createdId?: string | undefined;
  updatedId?: string | undefined;
  deletedId?: string | undefined;
  descriptionSuffix?: string | undefined;
};

export default function SuccessCreatedToast({ entityLabel, createdId, updatedId, deletedId, descriptionSuffix }: Props) {
  const { toast } = useToast();
  useEffect(() => {
    if (createdId) {
      toast({
        variant: "success",
        title: `${entityLabel} created`,
        description: descriptionSuffix ?? `Your new ${entityLabel.toLowerCase()} has been saved.`,
        duration: 4500,
      });
    } else if (updatedId) {
      toast({
        variant: "success",
        title: `${entityLabel} saved`,
        description: `${entityLabel} details have been updated successfully.`,
        duration: 4500,
      });
    } else if (deletedId) {
      toast({
        variant: "success",
        title: `${entityLabel} deleted`,
        description: `${entityLabel} has been marked inactive.`,
        duration: 4500,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdId, updatedId, deletedId, entityLabel, descriptionSuffix]);
  return null;
}
