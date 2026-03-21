import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-[var(--radius-md)] px-3 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-primary-fixed)] text-[var(--color-on-primary-fixed-variant)]",
        secondary: "bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]",
        success: "bg-emerald-500/10 text-emerald-600",
        warning: "bg-amber-500/10 text-amber-600",
        destructive: "bg-red-500/10 text-red-600",
        gradient: "bg-[var(--color-primary-fixed)] text-[var(--color-on-primary-fixed-variant)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant, className }))}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
