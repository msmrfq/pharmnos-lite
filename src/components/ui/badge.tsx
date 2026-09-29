import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-pill px-3 py-1 text-caption font-medium transition-none",
  {
    variants: {
      variant: {
        default: "bg-surface-card text-ink",
        outline: "border border-hairline text-body",
        secondary: "bg-surface-soft text-ink",
        success: "bg-semantic-success/10 text-semantic-success",
        warning: "bg-semantic-warning/10 text-semantic-warning",
        destructive: "bg-semantic-error/10 text-semantic-error",
        info: "bg-brand-accent/10 text-brand-accent",
        "badge-orange": "bg-badge-orange/15 text-[hsl(var(--badge-orange))]",
        "badge-pink": "bg-badge-pink/15 text-[hsl(var(--badge-pink))]",
        "badge-violet": "bg-badge-violet/15 text-[hsl(var(--badge-violet))]",
        "badge-emerald": "bg-badge-emerald/15 text-[hsl(var(--badge-emerald))]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
