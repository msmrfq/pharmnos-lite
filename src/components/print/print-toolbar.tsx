"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface PrintToolbarProps {
  backHref: string;
  backLabel?: string;
  title?: string;
  children?: ReactNode;
}

export function PrintButton({
  onClick,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      variant="secondary"
      size="sm"
      type="button"
      onClick={(e) => {
        if (onClick) onClick(e);
        window.print();
      }}
      className={className}
      aria-label="Print"
      {...props}
    >
      <Printer className="h-4 w-4" />
      Print
    </Button>
  );
}

export function PrintToolbar({
  backHref,
  backLabel = "Back",
  title,
  children,
}: PrintToolbarProps) {
  return (
    <div className="no-print sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-hairline flex items-center justify-between px-4 py-2 gap-2 mb-4 print:hidden">
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" asChild>
          <Link href={backHref} aria-label={backLabel}>
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
        {title && (
          <span className="font-semibold text-ink">{title}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {children}
        <PrintButton />
      </div>
    </div>
  );
}
