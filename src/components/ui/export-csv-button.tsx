"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { ButtonProps } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { GENERIC_EXPORT_FAILURE, resolveCsvExport, type CsvExportResult } from "@/lib/utils/csv-export-result";

type ExportAction = () => Promise<CsvExportResult>;

type Props = Omit<ButtonProps, "onClick" | "type"> & {
  action: ExportAction;
  filenameFallback?: string;
  children?: React.ReactNode;
};

export default function ExportCsvButton({ action, filenameFallback, children, ...rest }: Props) {
  const [pending, setPending] = useState(false);
  const aRef = useRef<HTMLAnchorElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    aRef.current = document.createElement("a");
    aRef.current.style.display = "none";
    document.body.appendChild(aRef.current);
    return () => {
      if (aRef.current) document.body.removeChild(aRef.current);
    };
  }, []);

  const onClick = async () => {
    if (pending) return;
    try {
      setPending(true);
      const res = await resolveCsvExport(await action(), filenameFallback);
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Export unavailable",
          description: res.reason,
          duration: 9000,
        });
        return;
      }
      const url = URL.createObjectURL(res.blob);
      if (aRef.current) {
        aRef.current.href = url;
        aRef.current.download = res.filename;
        aRef.current.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("CSV export failed:", error);
      toast({
        variant: "destructive",
        title: "Could not export CSV",
        description: GENERIC_EXPORT_FAILURE,
        duration: 5500,
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Button type="button" onClick={onClick} disabled={pending} {...rest}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Preparing…
        </>
      ) : (
        children ?? "Export CSV"
      )}
    </Button>
  );
}
