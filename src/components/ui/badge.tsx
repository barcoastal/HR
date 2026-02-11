import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
        secondary:
          "bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)]",
        success:
          "bg-green-500/10 text-green-600 dark:text-green-400",
        warning:
          "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
        destructive:
          "bg-red-500/10 text-red-600 dark:text-red-400",
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
