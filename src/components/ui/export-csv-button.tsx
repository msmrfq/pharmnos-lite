"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { ButtonProps } from "@/components/ui/button";

type ExportAction = () => Promise<Response>;

type Props = Omit<ButtonProps, "onClick" | "type"> & {
  action: ExportAction;
  filenameFallback?: string;
  children?: React.ReactNode;
};

export default function ExportCsvButton({ action, filenameFallback, children, ...rest }: Props) {
  const [pending, setPending] = useState(false);
  const aRef = useRef<HTMLAnchorElement | null>(null);

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
      const res = await action();
      const blob = await res.blob();
      if (!blob.size) {
        setPending(false);
        return;
      }
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^";]+)"?/);
      const filename = match?.[1] ?? filenameFallback ?? `export-${Date.now()}.csv`;
      const url = URL.createObjectURL(blob);
      if (aRef.current) {
        aRef.current.href = url;
        aRef.current.download = filename;
        aRef.current.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 1000);
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
